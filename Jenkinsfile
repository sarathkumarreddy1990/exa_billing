@Library("kmha-infrastructure") _
import com.kmha.exa.builders.BaseBuilder
import com.kmha.exa.builders.BillingBuilder

properties ([
  disableConcurrentBuilds(),
  [$class: 'jenkins.model.BuildDiscarderProperty',
   strategy: [$class: 'LogRotator',
              numToKeepStr: '50',
              artifactNumToKeepStr: '20']],
  parameters ([
    booleanParam(name: "UPLOAD_ARTIFACTS",
                 defaultValue: false,
                 description: "Upload artifacts to file servers?"),
    choiceParam(name: "DEBUG_LEVEL",
                choices: ["0", "1", "2", "3"],
                description: "Debug level; 0=less verbose, 3=most verbose")
  ])
])

node('windows2016-node-14.15.1') {
  def wb = new BillingBuilder()
  wb.buildAndArchiveArtifact()
}
