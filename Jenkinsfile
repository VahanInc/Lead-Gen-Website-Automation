pipeline {
    // Fargate 'default' pod template (has aws-cli, zip, git). No docker daemon —
    // the build + Playwright + Lighthouse run on CodeBuild (project 'lead-gen-tests');
    // this agent only zips the context, triggers the build, and pulls reports back.
    agent { label 'default' }

    environment {
        AWS_REGION       = 'ap-south-1'
        CODEBUILD_PROJECT = 'lead-gen-tests'
        CONTEXT_BUCKET   = 'vahan-jenkins-build-context'
        ARTIFACT_PREFIX  = 'lead-gen-artifacts'
        BASE_URL         = credentials('LEAD_GEN_BASE_URL')
        SLACK_WEBHOOK    = credentials('SLACK_WEBHOOK_URL')
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10', artifactNumToKeepStr: '1'))
        timeout(time: 40, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    triggers {
        cron('H 5 * * *')   // Playwright runs daily 10:00–10:59 IST
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                // Wipe any stale reports from a prior run so a failed build can't be
                // scored against last run's results. These are plain agent-side files
                // now (no root-owned docker outputs), so a host rm is enough.
                sh 'rm -rf lighthouse-report lighthouse-report-mobile test-results playwright-report pw_exit.txt lh_desk_exit.txt lh_mob_exit.txt'
            }
        }

        stage('Build + Test on CodeBuild') {
            steps {
                script {
                    // Lighthouse gating (was the stage `when`): cron builds run it only
                    // on Mondays (IST); manual builds always run it.
                    def isTimer = currentBuild.getBuildCauses('hudson.triggers.TimerTrigger$TimerTriggerCause').size() > 0
                    def cal = Calendar.getInstance(TimeZone.getTimeZone('Asia/Kolkata'))
                    env.RUN_LIGHTHOUSE = (!isTimer || cal.get(Calendar.DAY_OF_WEEK) == Calendar.MONDAY).toString()

                    // Zip the checkout to S3, start the CodeBuild project, poll it, then
                    // sync the reports back into the workspace. No withCredentials for AWS:
                    // the Fargate agent authenticates via IRSA (StartBuild + S3).
                    sh '''#!/bin/bash
                        set -euo pipefail
                        # ~/.aws is mounted read-only; give the AWS CLI a writable HOME for its cache.
                        export HOME="$(mktemp -d)"

                        job="${JOB_NAME:-manual}"; job="${job//[ \\/]/_}"
                        KEY="contexts/${job}-${BUILD_NUMBER}-$(date +%s).zip"

                        echo ">> zipping context -> s3://${CONTEXT_BUCKET}/${KEY}"
                        tmp="$(mktemp -d)"
                        zip -rq "$tmp/ctx.zip" . -x '.git/*' 'node_modules/*'
                        aws s3 cp "$tmp/ctx.zip" "s3://${CONTEXT_BUCKET}/${KEY}" --region "${AWS_REGION}" --only-show-errors

                        echo ">> starting CodeBuild ${CODEBUILD_PROJECT} (RUN_LIGHTHOUSE=${RUN_LIGHTHOUSE})"
                        BID="$(aws codebuild start-build \
                          --project-name "${CODEBUILD_PROJECT}" --region "${AWS_REGION}" \
                          --source-location-override "${CONTEXT_BUCKET}/${KEY}" --source-type-override S3 \
                          --environment-variables-override \
                              "name=BASE_URL,value=${BASE_URL},type=PLAINTEXT" \
                              "name=RUN_LIGHTHOUSE,value=${RUN_LIGHTHOUSE},type=PLAINTEXT" \
                          --artifacts-override "type=S3,location=${CONTEXT_BUCKET},path=${ARTIFACT_PREFIX},namespaceType=NONE,name=${BUILD_NUMBER},packaging=NONE" \
                          --query 'build.id' --output text)"
                        echo ">> build id: ${BID}"

                        status=IN_PROGRESS
                        while [ "$status" = "IN_PROGRESS" ]; do
                          sleep 10
                          status="$(aws codebuild batch-get-builds --ids "$BID" --region "${AWS_REGION}" --query 'builds[0].buildStatus' --output text)"
                          echo "   ... $status"
                        done

                        echo ">> pulling reports s3://${CONTEXT_BUCKET}/${ARTIFACT_PREFIX}/${BUILD_NUMBER}/ -> workspace"
                        aws s3 sync "s3://${CONTEXT_BUCKET}/${ARTIFACT_PREFIX}/${BUILD_NUMBER}/" . --region "${AWS_REGION}" --only-show-errors || true

                        if [ "$status" != "SUCCEEDED" ]; then
                          echo "!! CodeBuild ${BID} finished: ${status} (infra failure — tests did not complete)"
                          echo "   logs: https://${AWS_REGION}.console.aws.amazon.com/codesuite/codebuild/projects/${CODEBUILD_PROJECT}/build/${BID//:/%3A}"
                          exit 1
                        fi
                        echo ">> CodeBuild SUCCEEDED — reports pulled"
                    '''

                    // Translate the captured exit codes into the Jenkins build result,
                    // mirroring the old catchError(FAILURE) on the test + lighthouse stages.
                    def rd = { f -> fileExists(f) ? (readFile(f).trim() ?: '1') : '0' }
                    def pw  = fileExists('pw_exit.txt') ? (readFile('pw_exit.txt').trim() ?: '1') : '1'
                    def lhd = rd('lh_desk_exit.txt')
                    def lhm = rd('lh_mob_exit.txt')
                    if (pw != '0' || lhd != '0' || lhm != '0') {
                        currentBuild.result = 'FAILURE'
                        echo "Marking build FAILURE (playwright=${pw}, lighthouse-desktop=${lhd}, lighthouse-mobile=${lhm})"
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
                    // A stage before tests (e.g. the CodeBuild infra failure) can leave
                    // no junit.xml; it's wiped at Checkout, so a build that never ran
                    // tests reports 0/0 rather than reusing a prior build's results.
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
                    // 'SKIPPED' when the stage was skipped (non-Monday cron build)
                    def lhDeskRaw    = sh(script: "cat lighthouse-report/lhci-issues.txt 2>/dev/null || echo 'SKIPPED'", returnStdout: true).trim()
                    def lhMobRaw     = sh(script: "cat lighthouse-report-mobile/lhci-issues.txt 2>/dev/null || echo 'SKIPPED'", returnStdout: true).trim()

                    def lhDeskLines  = lhDeskRaw.split('\n') as List
                    def lhDeskStatus = lhDeskLines[0].trim()
                    def lhDeskIssues = lhDeskLines.size() > 1 ? lhDeskLines[1..-1].join('\n') : ''
                    def lhDeskFailed = lhDeskStatus == 'FAIL'

                    def lhMobLines   = lhMobRaw.split('\n') as List
                    def lhMobStatus  = lhMobLines[0].trim()
                    def lhMobIssues  = lhMobLines.size() > 1 ? lhMobLines[1..-1].join('\n') : ''
                    def lhMobFailed  = lhMobStatus == 'FAIL'

                    def lhFailed  = lhDeskFailed || lhMobFailed
                    def lhSkipped = lhDeskStatus == 'SKIPPED' && lhMobStatus == 'SKIPPED'

                    def lhFooter  = lhSkipped
                        ? "_Lighthouse not scheduled today — runs every Monday_"
                        : "<${lhDeskUrl}|Desktop Report>  |  <${lhMobUrl}|Mobile Report>"

                    def lhBlock = ''
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
                        // No tests ran at all (e.g. the CodeBuild build failed before
                        // Playwright started) — never report this as a pass.
                        text = ":red_circle: *Lead Gen Tests DID NOT RUN* — Build #${env.BUILD_NUMBER} (${branch})\n" +
                               "Pipeline failed before Playwright tests could execute (result: ${buildResult}). Likely a CodeBuild or infra issue.\n" +
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
