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
        TARGET_BRANCH = "jenkins_test"
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
            
                sh "docker compose -f docker-compose.deploy.yml up -d --force-recreate frontend backend"
            }
        }
    }

    post {
        always {
            sh "rm -f ./.env"
            sh "docker image prune -f"
        }
    }
}