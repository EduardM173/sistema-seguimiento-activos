pipeline {
    agent any 
    options{
        quietPeriod(3)
    }
    
    triggers {
        githubPush()
    }

    environment{
        SECRET_ENV_PATH = credentials('env_activos_dev')
        
        TAG = "${env.BUILD_NUMBER}"
        TARGET_BRANCH = "Sprint3_DEV"
    }

    stages {
        stage('SCM Checkout') {
            steps {
                checkout scm
                sh "echo se subio la wea ${env.TARGET_BRANCH}"
            }
        }

        stage('Setup Environment') {
            steps {
                sh 'cp $SECRET_ENV_PATH ./.env'
            }
        }

        stage('Docker Build') {
            steps {
                sh "docker compose -f docker-compose.deploy.yml build"
            }
        }

        stage('Deploy Detached') {  
            when {
                expression { 
                    return env.GIT_BRANCH == "origin/${env.TARGET_BRANCH}" || env.GIT_BRANCH == env.TARGET_BRANCH 
                }
            }
            steps {
                sh "docker compose -f docker-compose.deploy.yml down"
                sh "docker compose -f docker-compose.deploy.yml up -d --force-recreate --remove-orphans"
            }
        }
    }

    post {
        always {
            sh "rm -f ./.env"
            sh "docker image prune -af"

            script {
                def buildStatus = currentBuild.currentResult ?: 'SUCCESS'
                def statusIcon = '❓'
                
                if (buildStatus == 'SUCCESS') {
                    statusIcon = '✅'
                } else if (buildStatus == 'FAILURE') {
                    statusIcon = '❌'
                } else if (buildStatus == 'UNSTABLE') {
                    statusIcon = '⚠️'
                } else if (buildStatus == 'ABORTED') {
                    statusIcon = '🛑'
                }

                def commitAuthor = "Desconocido"
                def commitMsg = "Sin mensaje"
                
                try {
                    commitAuthor = sh(script: "git log -1 --pretty=format:'%an'", returnStdout: true).trim()
                    commitMsg = sh(script: "git log -1 --pretty=format:'%s'", returnStdout: true).trim()
                } catch (Exception e) {
                    echo "Advertencia: No se pudo extraer la metadata de Git. Asegúrate de que el stage de SCM se haya ejecutado."
                }

                withCredentials([string(credentialsId: 'DISCORD_WEBHOOK', variable: 'DISCORD_URL')]) {
                    discordSend(
                        webhookURL: env.DISCORD_URL,
                        title: "${statusIcon} Build ${buildStatus}: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                        description: """
                        **Autor:** ${commitAuthor}
                        **Commit:** `${commitMsg}`
                        
                        [Ver logs detallados en Jenkins](${env.BUILD_URL})
                        """.stripIndent(),
                        result: buildStatus,
                        footer: "Jenkins CI/CD Pipeline",
                        successful: buildStatus == 'SUCCESS'
                    )
                }
            }
        }
    }
}