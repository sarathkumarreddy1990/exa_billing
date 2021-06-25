// -*- mode: groovy; -*-
private String getGitHash() {
    return sh(script: "git rev-parse --short HEAD",
              returnStdout: true).trim()
}

private String getAppVersion() {
  String branch = env.BRANCH_NAME
  if (branch.contains("/")) {
    branch = branch.replaceAll("/", "-")
  }
  return branch
}

// This function should get the appName part in
// git@bitbucket.org:kmha/appName.git
//
// $ git remove -v gives...
// origin	git@bitbucket.org:kmha/appName.git (fetch)
// origin	git@bitbucket.org:kmha/appName.git (push)
//
// split("/n")[0] gets the first line
// split(" ")[1] gets git@bitbucket.org:kmha/appName.git
// split("/")[1] gets repoName.git
// tokenize(".")[0] gets repoName
private String getAppName() {
  return sh(script: "git remote -v",
            returnStdout: true).split("/n")[0].split(" ")[1].split("/")[1].tokenize(".")[0]
}

pipeline {
  environment {
    FTP_CONFIG = "devops"
    GIT_HASH = getGitHash()
    APP_NAME = getAppName()
    APP_VERSION = getAppVersion()
  }
  options {
    timeout(time: 60, unit: 'MINUTES')
    ansiColor('xterm')
    timestamps()
  }
  agent { node { label 'windows2016-node-14.15.1' } }
  stages {
    stage ('build') {
      steps {
        sh 'npm run build'
      }
    }
  }
  post {
    success {
      archiveArtifacts allowEmptyArchive: true,
                       artifacts: 'dist/*,logs/*',
                       fingerprint: true

      // Upload to FTP site using directory structure
      // /devops/$APP_NAME/$APP_VERSION
      dir ('dist') {
        ftpPublisher alwaysPublishFromMaster: true,
                     continueOnError: false,
                     failOnError: true,
                     masterNodeName: "",
                     paramPublish: [parameterName:""],
                     publishers: [
                       [configName: "$FTP_CONFIG",
                        transfers: [[asciiMode: false,
                                     cleanRemote: false,
                                     excludes: '',
                                     flatten: false,
                                     makeEmptyDirs: false,
                                     noDefaultExcludes: false,
                                     patternSeparator: '[, ]+',
                                     remoteDirectory: "$APP_NAME/$APP_VERSION",
                                     remoteDirectorySDF: false,
                                     removePrefix: '',
                                     sourceFiles: '**.zip, **.log']],
                        usePromotionTimestamp: false,
                        useWorkspaceInPromotion: false,
                        verbose: true]]
      }
    }
  }
}
