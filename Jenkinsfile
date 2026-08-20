pipeline {
    agent any

    environment {
        BASE_URL      = credentials('LEAD_GEN_BASE_URL')
        SLACK_WEBHOOK = credentials('SLACK_WEBHOOK_URL')
        // The K8s Jenkins agent pod (template "default") has no Docker — see the
        // ENOSPC/"docker: not found" incidents on this job. Tests now run on AWS
        // CodeBuild instead, following the same pattern the "Lead Generation
        // Website/Production" job already uses to build & push its Docker image
        // (S3-zipped context, aws codebuild start-build, polled from Jenkins).
        //
        // TODO(owner of the AWS CodeBuild setup — confirm/create before this runs):
        //   - CODEBUILD_PROJECT: a CodeBuild project running buildspec.yml from this
        //     repo (Node 20 image, NOT privileged — no Docker needed, see buildspec.yml).
        //     Distinct from "jenkins-app-build", which only builds+pushes images.
        //   - CONTEXT_BUCKET / ARTIFACT_BUCKET: confirm whether to reuse
        //     "vahan-jenkins-build-context" (used by the Production job) or use a
        //     dedicated bucket/prefix for this job's context zips and test artifacts.
        //   - The CodeBuild project's service role needs s3:GetObject on the context
        //     bucket/prefix and s3:PutObject on the artifact bucket/prefix.
        //   - The Jenkins agent's IAM role (jenkins-agent service account) needs
        //     s3:PutObject on the context bucket and codebuild:StartBuild /
        //     codebuild:BatchGetBuilds on CODEBUILD_PROJECT, plus s3:GetObject on the
        //     artifact bucket to pull results back.
        CODEBUILD_PROJECT = 'lead-gen-website-tests'
        CONTEXT_BUCKET    = 'vahan-jenkins-build-context'
        ARTIFACT_BUCKET   = 'vahan-jenkins-build-context'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10', artifactNumToKeepStr: '1'))
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    triggers {
        cron('H 5 * * *')   // Playwright runs daily 10:00–10:59
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                // Prevent stale results from a prior run being mistaken for this
                // build's result when a later stage fails or is skipped. No Docker
                // on this agent, so these are plain host files now (no more root
                // ownership from a container) — a normal rm is enough.
                sh 'rm -rf lighthouse-report lighthouse-report-mobile test-results playwright-report'
            }
        }

        stage('Run tests on CodeBuild') {
            steps {
                catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                    script {
                        // Cron builds: run Lighthouse only on Mondays (IST). Manual builds: always run.
                        def isTimer = currentBuild.getBuildCauses('hudson.triggers.TimerTrigger$TimerTriggerCause').size() > 0
                        def cal = Calendar.getInstance(TimeZone.getTimeZone('Asia/Kolkata'))
                        def runLighthouse = (!isTimer || cal.get(Calendar.DAY_OF_WEEK) == Calendar.MONDAY) as String
                        // Persisted so the post{} block can tell "genuinely not scheduled
                        // today" apart from "was scheduled but produced no report" (e.g. the
                        // RUN_LIGHTHOUSE-clobbered-by-buildspec bug) instead of inferring it
                        // from whether lhci-issues.txt happens to exist.
                        env.RUN_LIGHTHOUSE = runLighthouse

                        def safeJobName = env.JOB_NAME.replaceAll('[^A-Za-z0-9._-]', '_')
                        def contextKey  = "contexts/${safeJobName}-${env.BUILD_NUMBER}.zip"

                        // Ship the repo to S3 as CodeBuild's build context — this
                        // agent has no Docker, so the actual build/test run happens
                        // entirely inside CodeBuild (see buildspec.yml at repo root).
                        sh """
                            zip -r -q /tmp/context.zip . -x '.git/*' -x 'node_modules/*'
                            aws s3 cp /tmp/context.zip s3://${CONTEXT_BUCKET}/${contextKey}
                        """

                        def buildId = sh(
                            script: """
                                aws codebuild start-build \
                                    --project-name ${CODEBUILD_PROJECT} \
                                    --source-type-override S3 \
                                    --source-location-override ${CONTEXT_BUCKET}/${contextKey} \
                                    --environment-variables-override name=BASE_URL,value=${BASE_URL},type=PLAINTEXT name=RUN_LIGHTHOUSE,value=${runLighthouse},type=PLAINTEXT \
                                    --query 'build.id' --output text
                            """,
                            returnStdout: true
                        ).trim()
                        echo "Started CodeBuild run: ${buildId}"

                        def status = 'IN_PROGRESS'
                        while (status == 'IN_PROGRESS') {
                            sleep(time: 15, unit: 'SECONDS')
                            status = sh(
                                script: "aws codebuild batch-get-builds --ids ${buildId} --query 'builds[0].buildStatus' --output text",
                                returnStdout: true
                            ).trim()
                            echo "CodeBuild ${buildId}: ${status}"
                        }

                        // Pull test-results/playwright-report/lighthouse-report* back
                        // from the CodeBuild artifact regardless of pass/fail, so the
                        // post-build Slack/junit steps below have real data to read.
                        def artifactLocation = sh(
                            script: "aws codebuild batch-get-builds --ids ${buildId} --query 'builds[0].artifacts.location' --output text",
                            returnStdout: true
                        ).trim().replaceFirst(/^arn:aws:s3:::/, '')   // location is an S3 ARN; s3 cp needs bucket/key

                        if (artifactLocation && artifactLocation != 'None') {
                            sh """
                                aws s3 cp s3://${artifactLocation} /tmp/artifacts.zip
                                unzip -o -q /tmp/artifacts.zip -d .
                            """
                        }

                        if (status != 'SUCCEEDED') {
                            error("CodeBuild run ${buildId} finished with status ${status}")
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            junit allowEmptyResults: true, testResults: 'test-results/junit.xml'
            archiveArtifacts artifacts: 'playwright-report/**, lighthouse-report/**, lighthouse-report-mobile/**', allowEmptyArchive: true

            script {
                try {
                    def duration    = currentBuild.durationString.replace(' and counting', '')
                    def branch      = env.GIT_BRANCH ?: 'main'
                    // Overall pipeline result — independent of what junit.xml says.
                    // The CodeBuild run itself can fail to even start (bad AWS creds,
                    // missing project, S3 upload failure) before Playwright ever runs;
                    // junit.xml is wiped at Checkout, so a build that never ran tests
                    // reports 0/0 rather than reusing a prior build's passing results.
                    def buildResult = currentBuild.currentResult ?: 'SUCCESS'
                    def pwUrl     = "${env.BUILD_URL}artifact/playwright-report/dashboard.png"
                    def lhDeskUrl = "${env.BUILD_URL}artifact/lighthouse-report/summary.png"
                    def lhMobUrl  = "${env.BUILD_URL}artifact/lighthouse-report-mobile/summary.png"

                    // ── Playwright result ──────────────────────────────────────
                    def pwFailed = sh(
                        script: "grep -oP 'failures=\"\\K[0-9]+' test-results/junit.xml 2>/dev/null | head -1 || echo '0'",
                        returnStdout: true
                    ).trim()
                    def pwTotal = sh(
                        script: "grep -oP 'tests=\"\\K[0-9]+' test-results/junit.xml 2>/dev/null | head -1 || echo '0'",
                        returnStdout: true
                    ).trim()
                    def pwFailedInt = pwFailed.isInteger() ? pwFailed.toInteger() : 0
                    def pwTotalInt  = pwTotal.isInteger()  ? pwTotal.toInteger()  : 0

                    // ── Lighthouse result (desktop + mobile) ──────────────────
                    // 'MISSING' (not 'SKIPPED') when the report file isn't there — Jenkins'
                    // own RUN_LIGHTHOUSE decision (env var, set from the Monday gate above)
                    // is the only reliable source of "genuinely not scheduled today". Falling
                    // back to file-presence to infer that meant a CodeBuild-side failure to
                    // produce the report (e.g. buildspec's own env.variables clobbering the
                    // start-build override) was silently reported as a scheduled skip.
                    def lhDeskRaw    = sh(script: "cat lighthouse-report/lhci-issues.txt 2>/dev/null || echo 'MISSING'", returnStdout: true).trim()
                    def lhMobRaw     = sh(script: "cat lighthouse-report-mobile/lhci-issues.txt 2>/dev/null || echo 'MISSING'", returnStdout: true).trim()

                    def lhDeskLines  = lhDeskRaw.split('\n') as List
                    def lhDeskStatus = lhDeskLines[0].trim()
                    def lhDeskIssues = lhDeskLines.size() > 1 ? lhDeskLines[1..-1].join('\n') : ''
                    def lhDeskFailed = lhDeskStatus == 'FAIL'

                    def lhMobLines   = lhMobRaw.split('\n') as List
                    def lhMobStatus  = lhMobLines[0].trim()
                    def lhMobIssues  = lhMobLines.size() > 1 ? lhMobLines[1..-1].join('\n') : ''
                    def lhMobFailed  = lhMobStatus == 'FAIL'

                    def lhScheduled = env.RUN_LIGHTHOUSE == 'true'
                    def lhSkipped   = !lhScheduled
                    // Scheduled to run, but no report came back — a real failure, not a skip.
                    def lhMissing   = lhScheduled && (lhDeskStatus == 'MISSING' || lhMobStatus == 'MISSING')
                    def lhFailed    = lhDeskFailed || lhMobFailed || lhMissing

                    def lhFooter  = lhSkipped
                        ? "_Lighthouse not scheduled today — runs every Monday_"
                        : lhMissing
                            ? "_:warning: Lighthouse ran but no report came back — check CodeBuild logs_"
                            : "<${lhDeskUrl}|Desktop Report>  |  <${lhMobUrl}|Mobile Report>"

                    def lhBlock = ''
                    if (lhMissing) lhBlock += "\n*⚠️ Lighthouse:* Scheduled to run (RUN_LIGHTHOUSE=true) but produced no report — check the CodeBuild build logs."
                    if (lhDeskFailed && lhDeskIssues) lhBlock += "\n*🖥 Desktop Issues:*\n${lhDeskIssues}"
                    if (lhMobFailed  && lhMobIssues)  lhBlock += "\n*📱 Mobile Issues:*\n${lhMobIssues}"

                    // ── Failed test names (only fetched when needed) ───────────
                    def failedNames = ''
                    if (pwFailedInt > 0) {
                        failedNames = sh(
                            script: """python3 -c "
import xml.etree.ElementTree as ET
tree = ET.parse('test-results/junit.xml')
names = ['• ' + tc.get('name','') for tc in tree.iter('testcase') if tc.find('failure') is not None]
print('\\\\n'.join(names[:10]))
" 2>/dev/null || echo '_Could not parse test names_'""",
                            returnStdout: true
                        ).trim()
                    }

                    // ── Compose message based on which component(s) failed ─────
                    def text
                    def consoleUrl = "${env.BUILD_URL}console"

                    if (pwTotalInt == 0 && buildResult != 'SUCCESS') {
                        // No tests ran at all (e.g. Docker build/image stage failed
                        // before Playwright started) — never report this as a pass.
                        text = ":red_circle: *Lead Gen Tests DID NOT RUN* — Build #${env.BUILD_NUMBER} (${branch})\n" +
                               "Pipeline failed before Playwright tests could execute (result: ${buildResult}). Likely a Docker build or infra issue.\n" +
                               "<${consoleUrl}|Console Output>"

                    } else if (pwFailedInt == 0 && !lhFailed && buildResult == 'SUCCESS') {
                        // Playwright green; Lighthouse either passed or skipped
                        text = ":white_check_mark: *Lead Gen Tests PASSED* — ${pwTotalInt} tests in ${duration}\n" +
                               "<${pwUrl}|Playwright Report>  |  ${lhFooter}"

                    } else if (pwFailedInt == 0 && lhFailed) {
                        // Tests pass but Lighthouse thresholds violated
                        text = ":warning: *Playwright PASSED — Lighthouse Thresholds FAILED* — Build #${env.BUILD_NUMBER} (${branch})\n" +
                               "*${pwTotalInt} / ${pwTotalInt} tests passed*  |  *Duration:* ${duration}\n" +
                               "${lhBlock}\n\n" +
                               "<${pwUrl}|Playwright Report>  |  ${lhFooter}"

                    } else if (pwFailedInt > 0 && !lhFailed) {
                        // Playwright failed; Lighthouse passed or skipped
                        text = ":red_circle: *Lead Gen Tests FAILED* — Build #${env.BUILD_NUMBER} (${branch})\n" +
                               "*Failed:* ${pwFailedInt} / ${pwTotalInt}  |  *Duration:* ${duration}\n\n" +
                               "*Failed tests:*\n${failedNames}\n\n" +
                               "<${pwUrl}|Playwright Report>  |  ${lhFooter}"

                    } else if (pwFailedInt > 0 && lhFailed) {
                        // Both Playwright and Lighthouse failed
                        text = ":red_circle: *Lead Gen Tests FAILED — Playwright + Lighthouse* — Build #${env.BUILD_NUMBER} (${branch})\n" +
                               "*Playwright:* ${pwFailedInt} / ${pwTotalInt} tests failed  |  *Duration:* ${duration}\n\n" +
                               "*Failed tests:*\n${failedNames}" +
                               "${lhBlock}\n\n" +
                               "<${pwUrl}|Playwright Report>  |  ${lhFooter}"

                    } else {
                        // Safety net: build result isn't SUCCESS but none of the
                        // above conditions matched (e.g. a post-test stage failed).
                        // Never fall through silently to a green message.
                        text = ":red_circle: *Lead Gen Tests — Build Failed* — Build #${env.BUILD_NUMBER} (${branch})\n" +
                               "Result: ${buildResult}\n" +
                               "<${consoleUrl}|Console Output>"
                    }

                    def payload = groovy.json.JsonOutput.toJson([text: text])
                    sh "curl -s -X POST -H 'Content-type: application/json' --data '${payload}' '${env.SLACK_WEBHOOK}'"
                } catch (e) {
                    echo "Slack notification failed: ${e.message}"
                }
            }
        }
    }
}
