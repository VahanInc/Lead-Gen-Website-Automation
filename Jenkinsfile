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
                        npx playwright test --workers=2
                """
            }
        }
    }

    post {
        always {
            junit allowEmptyResults: true, testResults: 'test-results/junit.xml'
            publishHTML(target: [
                allowMissing         : true,
                alwaysLinkToLastBuild: true,
                keepAll              : true,
                reportDir            : 'playwright-report',
                reportFiles          : 'index.html',
                reportName           : 'Playwright Report'
            ])
            sh "docker rmi ${IMAGE_NAME} || true"
        }

        failure {
            script {
                try {
                    def tr       = currentBuild.testResultAction
                    def failed   = tr ? tr.failCount : '?'
                    def total    = tr ? tr.totalCount : '?'
                    def names    = tr
                        ? tr.failedTests.take(10).collect { "• ${it.fullDisplayName}" }.join('\\n')
                        : '_No test data available_'
                    def duration  = currentBuild.durationString.replace(' and counting', '')
                    def branch    = env.GIT_BRANCH ?: 'main'
                    def reportUrl = "${env.BUILD_URL}Playwright_20Report"

                    def payload = groovy.json.JsonOutput.toJson([
                        text: ":red_circle: *Lead Gen Tests FAILED* — Build #${env.BUILD_NUMBER} (${branch})\n" +
                              "*Failed:* ${failed} / ${total}  |  *Duration:* ${duration}\n\n" +
                              "*Failed tests:*\n${names}\n\n" +
                              "<${reportUrl}|:bar_chart: View Playwright Report>"
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
                    def tr        = currentBuild.testResultAction
                    def total     = tr ? tr.totalCount : '?'
                    def duration  = currentBuild.durationString.replace(' and counting', '')
                    def reportUrl = "${env.BUILD_URL}Playwright_20Report"

                    def payload = groovy.json.JsonOutput.toJson([
                        text: ":white_check_mark: *Lead Gen Tests PASSED* — ${total} tests in ${duration}   <${reportUrl}|View Report>"
                    ])

                    sh "curl -s -X POST -H 'Content-type: application/json' --data '${payload}' '${env.SLACK_WEBHOOK}'"
                } catch (e) {
                    echo "Slack alert failed: ${e.message}"
                }
            }
        }
    }
}
