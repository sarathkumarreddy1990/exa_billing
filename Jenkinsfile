// -*- mode: groovy; -*-
pipeline {
    options {
	timeout(time: 60, unit: 'MINUTES')
	ansiColor('xterm')
	timestamps()
    }
    agent { node { label 'windows2016-node-14.15.1' } }
    stages {
	stage ('build') {
	    steps{
		sh 'npm run build'
	    }
	}
    }
    post {
	always {
	    archiveArtifacts allowEmptyArchive: true, artifacts: 'dist/*,logs/*', fingerprint: true
	}
    }
}
