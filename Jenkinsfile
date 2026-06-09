pipeline {
    agent any

    environment {
        IMAGE_NAME   = "lead-gen-tests:${env.BUILD_NUMBER}"
        BASE_URL     = credentials('LEAD_GEN_BASE_URL')
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
            // Publish JUnit results for per-test pass/fail in Jenkins UI
            junit allowEmptyResults: true, testResults: 'test-results/junit.xml'

            // Publish the full Playwright HTML report
            publishHTML(target: [
                allowMissing         : true,
                alwaysLinkToLastBuild: true,
                keepAll              : true,
                reportDir            : 'playwright-report',
                reportFiles          : 'index.html',
                reportName           : 'Playwright Report'
            ])

            // Clean up the Docker image to save disk space
            sh "docker rmi ${IMAGE_NAME} || true"
        }

        failure {
            echo 'Tests failed — check the Playwright Report above for details.'
        }
    }
}
