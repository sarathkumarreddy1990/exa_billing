// -*- mode: groovy; -*-
// Don't save artifacts on pull requests by default
final save_artifacts_default = !env.CHANGE_ID
pipeline {
    parameters {
        booleanParam(name: 'SAVE_ARTIFACTS', defaultValue: save_artifacts_default, description: "Save artifacts from build")
        choice(
            name: 'label',
            choices: [
                // First choice is default
                'nodejs:8.12.0',
                'nodejs:8.13.0',
                'nodejs:10.14.1',
            ],
            description: 'NodeJS version.  See $JENKINS_HOST/configure -> Docker Agent Templates to add new')
    }
    environment {
        SAVE_ARTIFACTS = String.valueOf(params.SAVE_ARTIFACTS)
    }
    options {
        timeout(time: 60, unit: 'MINUTES')
        ansiColor('xterm')
        timestamps()
    }
    agent { node { label params.label as String} }
    stages {
	stage('Show Environment') {
	    steps {
		powershell 'Get-ChildItem Env:'
		fileExists 'package.json'
	    }
	}
	stage('Install NPM packages') {
	    steps {
		powershell '''
# Unsure on Powershell's arbitrary variable as boolean behavior
$NpmInstallUnSafe = -Not(-Not($Env:TAG_NAME))
npm ci
if (-Not($?)) {
  if ($NpmInstallUnSafe) {
    Throw "npm ci failed and not safe to do npm install"
  }
  npm install
  if (-Not($?)) {
      Throw "npm install failed"
  }
}
'''
	    }
	}
	stage('Build') {
	    steps {
		powershell 'npx gulp --no-color check-build-environment'
		powershell 'npm run build' // gulp build misses pre-reqs
	    }
	}
    }
    post {
	success {
	    script {
		if (params.SAVE_ARTIFACTS) {
		    archiveArtifacts artifacts: 'dist/*.zip', fingerprint: true
		}
	    }
	}
	failure {
	    echo "Figure out where the logs are..."
	}
    }
}
