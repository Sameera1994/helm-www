const { events, Job, Group } = require("brigadier");

events.on("exec", (e, p) => {
  const docsOut = "/mnt/brigade/share/docs.helm.sh"
  const helmOut = "/mnt/brigade/share/helm.sh"
  const bucket  = "https://docshelmshtest.blob.core.windows.net/docshelmtest"

  const buildDocs = new Job("docs-helm-sh", "node:9");
  // Just build a base image instead of doing this each time
  buildDocs.env = {
    HUGO_VERSION: "0.36"
  }
  buildDocs.tasks = [
    "apt-get update -y && apt-get install -yq ruby ruby-dev",
    "gem install sass",
    "curl -L https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_${HUGO_VERSION}_Linux-64bit.tar.gz | tar -xz -C /usr/local/bin hugo",
    "cd /src/docs.helm.sh",
    "yarn install",
    "$(yarn bin)/bower --allow-root install",
    "$(yarn bin)/gulp clonedocs",
    "$(yarn bin)/gulp build",
    `mkdir -p ${docsOut}`,
    `hugo -d ${docsOut}`,
    `ls -lah ${docsOut}`
  ];

  const buildHelmSh = new Job("helm-sh", "node:9");
  buildHelmSh.storage.enabled = true
  buildHelmSh.tasks = [
    "apt-get update -y && apt-get install -yq ruby ruby-dev",
    "npm install -g gulp",
    "gem install bundler",
    "gem install nokogiri -v '1.8.1'", // This is a temporary fix for an install problem
    "cd /src/helm.sh/",
    "bundle install",
    "npm install",
    "gulp",
    `mkdir -p ${helmOut}`,
    `bundle exec jekyll build -d ${helmOut}`
  ];

  const az = new Job("az", "azuresdk/azure-cli-python:latest")
  az.storage.enabled = true
  az.tasks = [
    `cd ${helmOut}`,
    `az storage blob upload-batch --destination ${bucket} --source ${helmOut} --dryrun`
  ];

  Group.runAll([buildDocs, buildHelmSh]).then(() => az.run());
});
