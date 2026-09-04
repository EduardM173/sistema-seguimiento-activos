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
        NEXUS_URL       = credentials('NEXUS_URL')
        
        TAG = "${env.BUILD_NUMBER}"
        TARGET_BRANCH = "Sprint5_DEV"
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
                // A previous build's containers can leave a root-owned ./.env in the
                // workspace that the Jenkins user can't overwrite. Remove it as root
                // from a sibling container sharing Jenkins' volumes before writing.
                sh 'docker run --rm --volumes-from jenkins busybox rm -f "$WORKSPACE/.env" || true'
                sh 'cp $SECRET_ENV_PATH ./.env'
                sh 'echo "NEXUS_URL=$NEXUS_URL" >> ./.env'
            }
        }

        stage('Docker Build') {
            steps {
                sh "docker compose -p seguimiento_activos -f docker-compose.prod.yml build"
            }
        }

        stage('Deploy Detached') {
            // when {
            //     expression {
            //         return env.GIT_BRANCH == "origin/${env.TARGET_BRANCH}" || env.GIT_BRANCH == env.TARGET_BRANCH
            //     }
            // }
            steps {
                // --remove-orphans clears stale containers from older compose files
                // (e.g. the Sprint4 docker-compose.deploy.yml stack that used to bind :8084).
                sh "docker compose -p seguimiento_activos -f docker-compose.prod.yml down --remove-orphans || true"
                sh "docker compose -p seguimiento_activos -f docker-compose.prod.yml up -d --force-recreate --remove-orphans"
            }
        }
    }

post {
        always {
            sh 'docker run --rm --volumes-from jenkins busybox rm -f "$WORKSPACE/.env" || rm -f ./.env || true'
            sh "docker image prune -af || true"

            script {
                withCredentials([string(credentialsId: 'DISCORD_WEBHOOK', variable: 'DISCORD_URL')]) {
                    sh """#!/bin/sh

                    RAW_AUTHOR=\$(git log -1 --pretty=format:'%an' 2>/dev/null || echo 'Sistema')
                    RAW_MSG=\$(git log -1 --pretty=format:'%s' 2>/dev/null || echo 'Error/Sin checkout')
                    
                    AUTHOR=\$(echo "\$RAW_AUTHOR" | sed 's/"/\\\\"/g')
                    MSG=\$(echo "\$RAW_MSG" | sed 's/"/\\\\"/g')

                    STATUS="${currentBuild.currentResult ?: 'SUCCESS'}"
                    
                    if [ "\$STATUS" = "SUCCESS" ]; then
                        COLOR=3066993
                        ICON="✅"
                    else
                        COLOR=15158332
                        ICON="❌"
                    fi

                    cat <<EOF > discord_payload.json
                    {
                      "username": "Jenkins CI",
                      "embeds": [{
                        "title": "\$ICON Build \$STATUS: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                        "description": "El pipeline ha finalizado en el sistema de seguimiento de activos.",
                        "color": \$COLOR,
                        "fields": [
                          { "name": "Autor", "value": "\$AUTHOR", "inline": true },
                          { "name": "Duración", "value": "${currentBuild.durationString}", "inline": true },
                          { "name": "Commit", "value": "\\`\$MSG\\`", "inline": false }
                        ]
                      }]
                    }
EOF

                    echo "Enviando payload a Discord..."
                    # Notification must never fail the build (Jenkins agent has no DNS/egress to discord.com in some networks).
                    curl -s -S --max-time 10 -H "Content-Type: application/json" -X POST -d @discord_payload.json "\$DISCORD_URL" || echo "Discord notification failed (ignored)"
                    """
                }
            }
        }
    }
}