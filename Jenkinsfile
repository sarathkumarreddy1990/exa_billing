// -*- mode: groovy; -*-
// Don't save artifacts on pull requests by default
final save_artifacts_default = false
pipeline {
    parameters {
        booleanParam(name: 'SAVE_ARTIFACTS', defaultValue: save_artifacts_default, description: "Save artifacts from build")
    }
    environment {
        SAVE_ARTIFACTS = String.valueOf(params.SAVE_ARTIFACTS)
    }
    options {
        timeout(time: 60, unit: 'MINUTES')
        ansiColor('xterm')
        timestamps()
    }
    agent { node { label 'windows2016-nvm' } }
    stages {
	stage('Environment') {
	    steps {
		sh 'printenv | sort'
		sh 'node --version'
		sh 'npm --version'
		sh 'use-node-npm.sh'
		sh 'node --version'
		sh 'npm --version'
		sh 'rm -vf *.zip dist/*.zip'
	    }
	}
	stage('npm ci') {
	    steps {
		sh 'npm ci'
	    }
	}
	stage('Build') {
	    steps {
		sh 'npm run build'
		sh 'npx gulp ftp-upload'
	    }
	}
    }
    post {
	failure {
	    echo "Figure out where the logs are..."
	}
    }
}
