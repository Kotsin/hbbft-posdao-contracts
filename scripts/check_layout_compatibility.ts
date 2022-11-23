const fs = require('fs');
const assert = require('assert');
const upgrades_core = require("@openzeppelin/upgrades-core");

main();

async function main() {
    console.log('Checking the contracts\' storage for conflicts...');

    let dir = './scripts/utils/';

    if (!fs.existsSync(dir)) {
        dir = '.' + dir;
    }

    const init_data_file = dir + 'storage-layout.json';
    assert(init_data_file, "Path to the older storage layout is required!");
    console.log(`Using init_data_file: ${init_data_file}`);
    let rawdata = fs.readFileSync(init_data_file);
    const origDeployData = JSON.parse(rawdata);

    dir = './cache/';

    if (!fs.existsSync(dir)) {
        dir = '.' + dir;
    }

    const new_data_file = dir + 'validations.json';
    assert(new_data_file, "Path to the older storage layout is required!");
    console.log(`Using new_data_file: ${new_data_file}`);
    rawdata = fs.readFileSync(new_data_file);
    const newDeployData = JSON.parse(rawdata);

    for (let j in origDeployData.log[0]) {
        if (typeof (origDeployData.log[0][j]) === "object" && !origDeployData.log[0][j].src.startsWith('contracts\\mockContracts')) {
            if (newDeployData.log[0]?.[j]) {
                upgrades_core.assertUpgradeSafe(newDeployData.log[0][j].layout, newDeployData.log[0][j].version)
                upgrades_core.assertStorageUpgradeSafe(origDeployData.log[0][j].layout, newDeployData.log[0][j].layout, { unsafeAllowRenames: true });
                console.log(`No conflicts in ${j}.sol`)
            }
            else {
                console.log(`${j} was removed`)
            }
        }
    }


    // console.log(init_data.log[2])

}






