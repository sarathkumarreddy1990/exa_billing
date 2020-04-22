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
mkdir -p logs
[ -d logs ]
(
    echo environment:
    printenv | sort
    echo node npm:
    node --version
    npm --version
) | tee logs/build.environment
'''
		// TODO: Should we allow an 'npm install' fallback on a branch with corresponding error file?
		sh 'npm ci'
	    }
	}
	stage ('Build') {
	    steps{
		sh '''\
set -e
set -o pipefail
npm run build 2>&1 | tee logs/build.log
'''
	    }
	}
    }
    post {
	always {
	    archiveArtifacts allowEmptyArchive: true, artifacts: 'dist/*,logs/*', fingerprint: true
	}
    }
}
