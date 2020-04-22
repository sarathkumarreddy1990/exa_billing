// -*- mode: groovy; -*-
pipeline {
    options {
	timeout(time: 60, unit: 'MINUTES')
	ansiColor('xterm')
	timestamps()
    }
    agent { node { label 'windows2016-node-10.16.3' } }
    stages {
	stage('prep') {
	    steps {
		sh '''\
set -e
(
    echo environment:
    printenv | sort
    echo node npm:
    node --version
    npm --version
) | tee build.environment
'''
		// TODO: Should we allow an 'npm install' fallback on a branch with corresponding error file?
		sh 'npm ci'
	    }
	}
	stage ('Build') {
	    steps{
		sh 'npm run build'
	    }
	}
    }
    post {
	always {
	    archiveArtifacts allowEmptyArchive: true, artifacts: 'dist/*', fingerprint: true
	}
    }
}
