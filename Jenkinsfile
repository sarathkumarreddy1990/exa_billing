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
	stage ('build') {
	    steps{
		sh '''\
set -e
set -o pipefail
npm run build 2>&1 | tee logs/build.log
'''
		dir('logs') {
		    sh '''\
rm -vf *.part.log *.error || :
awk -v single="'" '$2=="Starting"{split($3, parts, single);f=parts[2]".part.log"}f!=""{print > f}' build.log
for f in requirejs*.part.log; do
    if ! grep --after-context=2 ^Error: "$f" > "$f.error"; then
        rm -vf "$f.error"
    fi
done
for f in *.part.log; do
    rc=0
    for t in warn error; do
        set +e
        [ -r "$f.$t" ]
        let 'rc=rc||'$?
        set -e
    done
    if [ "$rc" -eq 1 ]; then
        rm -vf "$f"
    fi
done
'''
		    script {
			if(findFiles(glob: '*.error')) {
			    // TODO: Should be fail when building from a tag
			    currentBuild.result = 'UNSTABLE'
			}
		    }
		}
	    }
	}
    }
    post {
	always {
	    archiveArtifacts allowEmptyArchive: true, artifacts: 'dist/*,logs/*', fingerprint: true
	}
    }
}
