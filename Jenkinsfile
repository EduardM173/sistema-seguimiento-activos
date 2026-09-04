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
                // Build ./.env from the Jenkins secret file + NEXUS_URL.
                // Use `cat >` not `cp`: `cp` copies the secret file's 0400 mode,
                // which then makes the `>>` append fail with "Permission denied".
                sh '''
                    set -eu
                    rm -f ./.env
                    cat "$SECRET_ENV_PATH" > ./.env
                    printf 'NEXUS_URL=%s\\n' "$NEXUS_URL" >> ./.env
                    chmod 600 ./.env
                '''
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
                sh "docker compose -p seguimiento_activos -f docker-compose.prod.yml down --remove-orphans --timeout 30 || true"
                // `restart:` containers can be resurrected by the runtime mid-`down`,
                // leaving a name conflict on `up` ("container name ... already in use").
                // Force-clear anything still labelled with this compose project.
                sh "docker ps -aq --filter label=com.docker.compose.project=seguimiento_activos | xargs -r docker rm -f || true"
                sh "docker compose -p seguimiento_activos -f docker-compose.prod.yml up -d --force-recreate --remove-orphans"
            }
        }
    }

post {
        always {
            sh 'rm -f ./.env || true'
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