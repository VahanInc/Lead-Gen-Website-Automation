pipeline {
    agent any

    environment {
        IMAGE_NAME    = "lead-gen-tests:${env.BUILD_NUMBER}"
        BASE_URL      = credentials('LEAD_GEN_BASE_URL')
        SLACK_WEBHOOK = credentials('SLACK_WEBHOOK_URL')
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build image') {
            steps {
                sh "docker build -t ${IMAGE_NAME} ."
            }
        }

        stage('Run tests') {
            steps {
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

        stage('Lighthouse') {
            steps {
                sh """
                    docker run --rm \
                        -e CI=true \
                        -e BASE_URL=${BASE_URL} \
                        -v ${WORKSPACE}/lighthouse-report:/app/lighthouse-report \
                        ${IMAGE_NAME} \
                        sh -c 'CHROME_PATH=\$(find /root/.cache/ms-playwright -name chrome -type f 2>/dev/null | head -1) npx lhci autorun; LHCI_EXIT=\$?; node scripts/generate-lighthouse-report.js 2>/dev/null || true; exit \$LHCI_EXIT'
                """
            }
            post {
                always {
                    archiveArtifacts artifacts: 'lighthouse-report/**', allowEmptyArchive: true
                }
            }
        }
    }

    post {
        always {
            junit allowEmptyResults: true, testResults: 'test-results/junit.xml'
            archiveArtifacts artifacts: 'playwright-report/**', allowEmptyArchive: true
            sh "docker rmi ${IMAGE_NAME} || true"
        }

        failure {
            script {
                try {
                    def duration      = currentBuild.durationString.replace(' and counting', '')
                    def branch        = env.GIT_BRANCH ?: 'main'
                    def reportUrl     = "${env.BUILD_URL}artifact/playwright-report/dashboard.png"
                    def lhciReportUrl = "${env.BUILD_URL}artifact/lighthouse-report/summary.png"

                    def failed = sh(
                        script: "grep -oP 'failures=\"\\K[0-9]+' test-results/junit.xml 2>/dev/null | head -1 || echo '?'",
                        returnStdout: true
                    ).trim()
                    def total = sh(
                        script: "grep -oP 'tests=\"\\K[0-9]+' test-results/junit.xml 2>/dev/null | head -1 || echo '?'",
                        returnStdout: true
                    ).trim()
                    def failedNames = sh(
                        script: """python3 -c \"
import xml.etree.ElementTree as ET
tree = ET.parse('test-results/junit.xml')
names = ['• ' + tc.get('name','') for tc in tree.iter('testcase') if tc.find('failure') is not None]
print('\\\\n'.join(names[:10]))
\" 2>/dev/null || echo '_Could not parse test names_'""",
                        returnStdout: true
                    ).trim()

                    def payload = groovy.json.JsonOutput.toJson([
                        text: ":red_circle: *Lead Gen Tests FAILED* — Build #${env.BUILD_NUMBER} (${branch})\n" +
                              "*Failed:* ${failed} / ${total}  |  *Duration:* ${duration}\n\n" +
                              "*Failed tests:*\n${failedNames}\n\n" +
                              "<${reportUrl}|:bar_chart: Playwright Report>  |  <${lhciReportUrl}|:lighthouse: Lighthouse Report>"
                    ])

                    sh "curl -s -X POST -H 'Content-type: application/json' --data '${payload}' '${env.SLACK_WEBHOOK}'"
                } catch (e) {
                    echo "Slack alert failed: ${e.message}"
                }
            }
        }

        success {
            script {
                try {
                    def duration      = currentBuild.durationString.replace(' and counting', '')
                    def reportUrl     = "${env.BUILD_URL}artifact/playwright-report/dashboard.png"
                    def lhciReportUrl = "${env.BUILD_URL}artifact/lighthouse-report/summary.png"

                    def total = sh(
                        script: "grep -oP 'tests=\"\\K[0-9]+' test-results/junit.xml 2>/dev/null | head -1 || echo '?'",
                        returnStdout: true
                    ).trim()

                    def payload = groovy.json.JsonOutput.toJson([
                        text: ":white_check_mark: *Lead Gen Tests PASSED* — ${total} tests in ${duration}   <${reportUrl}|Playwright Report>  |  <${lhciReportUrl}|:lighthouse: Lighthouse Report>"
                    ])

                    sh "curl -s -X POST -H 'Content-type: application/json' --data '${payload}' '${env.SLACK_WEBHOOK}'"
                } catch (e) {
                    echo "Slack alert failed: ${e.message}"
                }
            }
        }
    }
}
