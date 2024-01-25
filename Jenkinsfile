@Library("kmha-infrastructure") _
import com.kmha.exa.builders.BaseBuilder
import com.kmha.exa.builders.BillingBuilder

// -------------------
// This code dynamically looks at the build results of the following
// job
def getBuildJob(final String jobName) {
  def buildJob = null
  Hudson.instance.getAllItems(Job.class).each {
    if (it.fullName == jobName) {
      buildJob = it
    }
  }
  return buildJob
}

def getAllBuildNumbers(Job job) {
  // "default" is used when this job is auto-triggered by the VersionMgr jobs
  // and will be handled as a no-op.
  def buildNumbers = [env.BRANCH_NAME]
  (job.getBuilds()).each {
    def status = it.getBuildStatusSummary().message
    if ((status.contains("stable") || status.contains("normal")) &&
         it.displayName.contains(".")) {
      buildNumbers.add(it.displayName)
    }
  }
  // "default" is used when this job is auto-triggered by the VersionMgr jobs
  // and will be handled as a no-op.
  buildNumbers.add("default")
  return buildNumbers
}
// -------------------

Job buildJob = null
buildNumbers = null
BUILD_JOB_NAME = null
boolean extendedProperties = false
final String branch = env.BRANCH_NAME.replaceAll("/", "%2F")
if(branch.contains("release")) {
  BUILD_JOB_NAME = "EXA-Platform/VersionMgr/exa-platform-version-builder/$branch"
  buildJob = getBuildJob(BUILD_JOB_NAME)
  if (buildJob) {
    buildNumbers = getAllBuildNumbers(buildJob)
    if (buildNumbers) {
      extendedProperties = true
    }
  }
}

if (extendedProperties) {
  properties ([
    disableConcurrentBuilds(),
    [$class: 'jenkins.model.BuildDiscarderProperty',
     strategy: [$class: 'LogRotator',
                numToKeepStr: '50',
                artifactNumToKeepStr: '20']],
    parameters ([
      choiceParam(name: "VERSION_CHOICE",
                  choices: buildNumbers,
                  description: "Version from $BUILD_JOB_NAME"),
      stringParam(name: "VERSION_PASSEDIN",
                  description: "Passed-in version. Note this will override VERSION_CHOICE."),
      booleanParam(name: "UPLOAD_ARTIFACTS",
                   defaultValue: false,
                   description: "Upload artifacts to file servers?"),
      choiceParam(name: "DEBUG_LEVEL",
                  choices: ["0", "1", "2", "3"],
                  description: "Debug level; 0=less verbose, 3=most verbose")
    ])
  ])
}
else {
  properties ([
    disableConcurrentBuilds(),
    [$class: 'jenkins.model.BuildDiscarderProperty',
     strategy: [$class: 'LogRotator',
                numToKeepStr: '50',
                artifactNumToKeepStr: '20']],
    parameters ([
      stringParam(name: "VERSION_PASSEDIN",
                  defaultValue: env.BRANCH_NAME,
                  description: "Passed-in version. Note this will override VERSION_CHOICE."),
      booleanParam(name: "UPLOAD_ARTIFACTS",
                   defaultValue: false,
                   description: "Upload artifacts to file servers?"),
      choiceParam(name: "DEBUG_LEVEL",
                  choices: ["0", "1", "2", "3"],
                  description: "Debug level; 0=less verbose, 3=most verbose")
    ])
  ])
}

node('exa-windows-node-18.x') {
  if(env.VERSION_CHOICE && env.VERSION_CHOICE == "default" &&
     !env.VERSION_PASSEDIN.trim()) {
    println "For testing only!"
  }
  def obj = new BillingBuilder(this, env.VERSION_PASSEDIN.trim(), env.DEBUG_LEVEL.toInteger(), env.UPLOAD_ARTIFACTS.toBoolean())
  obj.buildAndArchiveArtifact()
}
