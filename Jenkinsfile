pipeline {
    agent any 
    
    triggers {
        githubPush()
    }

    environment {
        TARGET_BRANCH = "jenkins_test"
    }

    stages {
        stage('SCM Checkout') {
            steps {
                // checkout scm

                sh "echo se subio la wea ${env.TARGET_BRANCH}"
            }
        }

        // stage('Docker Build') {
        //     when {
        //         branch "${env.TARGET_BRANCH}"
        //     }
        //     steps {
        //         sh "docker compose build"
        //     }
        // }

        // stage('Deploy Detached') {
        //     when {
        //         branch "${env.TARGET_BRANCH}"
        //     }
        //     steps {
        //         sh "docker compose up --force-recreate frontend backend"
        //     }
        // }
    }

    // post {
    //     always {
    //         sh "docker image prune -f"
    //     }
    // }
}