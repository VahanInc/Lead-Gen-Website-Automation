pipeline {
    agent any

    environment {
        IMAGE_NAME    = "lead-gen-tests:${env.BUILD_NUMBER}"
        BASE_URL      = credentials('LEAD_GEN_BASE_URL')
        SLACK_WEBHOOK = credentials('SLACK_WEBHOOK_URL')
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
                // build's result when a later stage fails or is skipped (e.g. the
                // Docker build stage failing before Playwright ever runs must not
                // leave a passing junit.xml from the last successful build behind).
                // These files are written by root inside the containers, so they
                // must also be removed as root via a throwaway container rather
                // than a plain host-side rm (which gets Permission denied).
                sh 'docker run --rm -v $WORKSPACE:/workspace alpine rm -rf /workspace/lighthouse-report /workspace/lighthouse-report-mobile /workspace/test-results /workspace/playwright-report'
            }
        }

        stage('Free disk space') {
            steps {
                // Dangling layers and stray images from this project accumulate across
                // daily builds and can eventually fill the host disk, failing the image
                // build outright (e.g. ENOSPC while downloading the Chromium binary).
                // This host may run other Jenkins jobs, so we deliberately avoid
                // `docker system prune -a` / `--volumes` here — those are daemon-wide
                // and would delete other jobs' unused images and volumes too. Instead:
                //   1) remove this project's own leftover lead-gen-tests:* image tags
                //      (in case a prior run's cleanup step didn't get to run)
                //   2) remove genuinely dangling (untagged, unreferenced-by-anything)
                //      image layers — these aren't any other job's tagged image
                sh '''
                    docker images "lead-gen-tests" -q | xargs -r docker rmi -f || true
                    docker image prune -f || true
                '''
            }
        }

        stage('Build image') {
            steps {
                sh "docker build -t ${IMAGE_NAME} ."
            }
        }

        stage('Run tests') {
            steps {
                catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                    sh """
                        docker run --rm \
                            -e CI=true \
                            -e BASE_URL=${BASE_URL} \
                            -v ${WORKSPACE}/playwright-report:/app/playwright-report \
                            -v ${WORKSPACE}/test-results:/app/test-results \
                            ${IMAGE_NAME} \
                            sh -c 'npx playwright test --workers=4; PW_EXIT=\$?; node scripts/generate-report.js 2>/dev/null || true; exit \$PW_EXIT'
                    """
                }
            }
        }

        stage('Lighthouse') {
            when {
                expression {
                    // Cron builds: run only on Mondays (IST). Manual builds: always run.
                    def isTimer = currentBuild.getBuildCauses('hudson.triggers.TimerTrigger$TimerTriggerCause').size() > 0
                    def cal = Calendar.getInstance(TimeZone.getTimeZone('Asia/Kolkata'))
                    return !isTimer || cal.get(Calendar.DAY_OF_WEEK) == Calendar.MONDAY
                }
            }
            steps {
                catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                    sh """
                        docker run --rm \
                            -e CI=true \
                            -e BASE_URL=${BASE_URL} \
                            -v ${WORKSPACE}/lighthouse-report:/app/lighthouse-report \
                            -v ${WORKSPACE}/lighthouse-report-mobile:/app/lighthouse-report-mobile \
                            ${IMAGE_NAME} \
                            sh -c '
                                CHROME=\$(find /root/.cache/ms-playwright -name chrome -type f 2>/dev/null | head -1)

                                CHROME_PATH=\$CHROME npx lhci autorun --config=.lighthouserc.js
                                DESK_EXIT=\$?
                                REPORT_DIR=/app/lighthouse-report REPORT_LABEL="Lighthouse Desktop" node scripts/generate-lighthouse-report.js 2>/dev/null || true

                                CHROME_PATH=\$CHROME npx lhci autorun --config=.lighthouserc.mobile.js
                                MOB_EXIT=\$?
                                REPORT_DIR=/app/lighthouse-report-mobile REPORT_LABEL="Lighthouse Mobile" PERF_MIN_SCORE=0.5 node scripts/generate-lighthouse-report.js 2>/dev/null || true

                                if [ \$DESK_EXIT -ne 0 ] || [ \$MOB_EXIT -ne 0 ]; then exit 1; else exit 0; fi
                            '
                    """
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'lighthouse-report/**, lighthouse-report-mobile/**', allowEmptyArchive: true
                }
            }
        }
    }

    post {
        always {
            junit allowEmptyResults: true, testResults: 'test-results/junit.xml'
            archiveArtifacts artifacts: 'playwright-report/**', allowEmptyArchive: true
            sh "docker rmi ${IMAGE_NAME} || true"

            script {
                try {
                    def duration    = currentBuild.durationString.replace(' and counting', '')
                    def branch      = env.GIT_BRANCH ?: 'main'
                    // Overall pipeline result — independent of what junit.xml says.
                    // A stage before "Run tests" (e.g. Docker build) can fail and skip
                    // Playwright entirely; junit.xml is now wiped at Checkout, so a
                    // build that never ran tests reports 0/0 rather than reusing a
                    // prior build's passing results.
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
