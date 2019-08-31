// -*- mode: groovy; -*-
def genChangelogs(template, file, build) {
    def fromCommit = sh (
	script: 'git --no-pager show -s --format=\'%H\' HEAD@{13weeks}',
	returnStdout: true
    ).trim()
    def from = [type: 'COMMIT', value: fromCommit ]
    echo 'fromCommit: ' + fromCommit
    def to = [type: 'REF', value: env.GIT_LOCAL_BRANCH ]
    def jira = [
	issuePattern: 'EXA-([0-9]+)\\b',
	password: '',
	server: 'https://viztek.atlassian.net',
	username: ''
    ]
    def changelog = gitChangelog returnType: 'STRING',
	from: from,
	to: to,
	jira: jira, template: template
    echo changelog
    writeFile file: file, text: changelog.take(4096)
    return changelog
}
pipeline {
    parameters {
	booleanParam(name: 'KeepPullRequestBuild', defaultValue: false, description: "Keep Pull Request Build Results")
    }
    environment {
	KeepPullRequestBuild = String.valueOf(params.KeepPullRequestBuild)
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
	stage ('Build') {
	    steps{
		sh 'npm run build'
		script {
		    template ="""
# Changelog

Changelog for {{ownerName}} {{repoName}}.

{{#tags}}
## {{name}}
 {{#issues}}
  {{#hasIssue}}
   {{#hasLink}}
### {{name}} [{{issue}}]({{link}}) {{title}} {{#hasIssueType}} *{{issueType}}* {{/hasIssueType}} {{#hasLabels}} {{#labels}} *{{.}}* {{/labels}} {{/hasLabels}}
   {{/hasLink}}
   {{^hasLink}}
### {{name}} {{issue}} {{title}} {{#hasIssueType}} *{{issueType}}* {{/hasIssueType}} {{#hasLabels}} {{#labels}} *{{.}}* {{/labels}} {{/hasLabels}}
   {{/hasLink}}
  {{/hasIssue}}
  {{^hasIssue}}
### {{name}}
  {{/hasIssue}}

  {{#commits}}
**{{{messageTitle}}}
{{#messageBodyItems}}
 * {{.}}
{{/messageBodyItems}}

[{{hash}}](https://bitbucket.org/{{ownerName}}/{{repoName}}/commits/{{hash}}) {{authorName}} *{{commitTime}}*

  {{/commits}}
 {{/issues}}
{{/tags}}

"""
		    htmltemplate="""
<h1>Changelog for {{ownerName}}/{{repoName}}</h1>
{{#tags}}
<h2> {{name}} </h2>
 {{#issues}}
 {{#hasIssue}}
 {{#hasLink}}
<h2> {{name}} <a href="{{link}}">{{issue}}</a> {{title}} </h2>
 {{/hasLink}}
 {{^hasLink}}
<h2> <a href="https://viztek.atlassian.net/browse/{{issue}}">{{name}} {{issue}} {{title}}</a> </h2>
 {{/hasLink}}
 {{/hasIssue}}
 {{^hasIssue}}
<h2> {{name}} </h2>
 {{/hasIssue}}


 {{#commits}}
<a href="https://bitbucket.org/{{ownerName}}/{{repoName}}/commits/{{hash}}">{{hash}}</a> {{authorName}} <i>{{commitTime}}</i>
<p>
<h3>{{{messageTitle}}}</h3>

{{#messageBodyItems}}
 <li> {{.}}</li>
{{/messageBodyItems}}
</p>


 {{/commits}}

 {{/issues}}
{{/tags}}
"""
		    genChangelogs(template, 'dist/CHANGELOG.md', currentBuild)
		    genChangelogs(htmltemplate, 'dist/CHANGELOG.html', currentBuild)
		}
	    }
	}
	stage ('Tidy') {
	    steps {
		sh 'rm -vf dist/*.zip'
	    }
	    when {
		allOf {
		    changeRequest author: '', authorDisplayName: '', authorEmail: '', branch: '', fork: '', id: '', target: '', title: '', url: ''
		    not {
			environment ignoreCase: true, name: 'KeepPullRequestBuild', value: 'true'
		    }
		}
	    }
	}
    }
    post {
	always {
	    archiveArtifacts allowEmptyArchive: true, artifacts: 'dist/*', fingerprint: true
	    withFolderProperties{
	    	ftpPublisher alwaysPublishFromMaster: false, continueOnError: false, failOnError: false, masterNodeName: 'vm-ubuntu-jenkins', paramPublish: [parameterName:''], publishers: [[configName: 'exa', transfers: [[asciiMode: false, cleanRemote: false, excludes: '', flatten: true, makeEmptyDirs: false, noDefaultExcludes: false, patternSeparator: '[, ]+', remoteDirectory: env.FTP_FOLDER, remoteDirectorySDF: false, removePrefix: '', sourceFiles: 'dist/*.zip']], usePromotionTimestamp: false, useWorkspaceInPromotion: false, verbose: false]]
	    }
	}
    }
}
