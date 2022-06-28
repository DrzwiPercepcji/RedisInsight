import { Chance } from 'chance';
import { rte } from '../../../helpers/constants';
import { acceptLicenseTermsAndAddDatabase, deleteDatabase } from '../../../helpers/database';
import { BrowserPage, CliPage } from '../../../pageObjects';
import {
    commonUrl,
    ossStandaloneConfig
} from '../../../helpers/conf';

const browserPage = new BrowserPage();
const cliPage = new CliPage();
const chance = new Chance();

let keyName = chance.word({ length: 20 });
let consumerGroupName = chance.word({ length: 20 });

fixture `Pending messages`
    .meta({ type: 'regression', rte: rte.standalone })
    .page(commonUrl)
    .beforeEach(async() => {
        await acceptLicenseTermsAndAddDatabase(ossStandaloneConfig, ossStandaloneConfig.databaseName);
    })
    .afterEach(async t => {
        //Clear and delete database
        if (await t.expect(browserPage.closeKeyButton.visible).ok()){
            await t.click(browserPage.closeKeyButton);
        }
        await browserPage.deleteKeyByName(keyName);
        await deleteDatabase(ossStandaloneConfig.databaseName);
    });
test('Verify that user can\'t select currently selected Consumer to Claim message in the drop-down', async t => {
    keyName = chance.word({ length: 20 });
    consumerGroupName = chance.word({ length: 20 });
    const consumerNames = [
        'Alice',
        'Bob'
    ];
    const cliCommands = [
        `XGROUP CREATE ${keyName} ${consumerGroupName} $ MKSTREAM`,
        `XADD ${keyName} * message apple`,
        `XADD ${keyName} * message orange`,
        `XREADGROUP GROUP ${consumerGroupName} ${consumerNames[0]} COUNT 1 STREAMS ${keyName} >`,
        `XREADGROUP GROUP ${consumerGroupName}  ${consumerNames[1]} COUNT 1 STREAMS ${keyName} >`
    ];
    // Add New Stream Key with pending message
    for(const command of cliCommands){
        await cliPage.sendCommandInCli(command);
    }
    // Open Stream pending view
    await browserPage.openStreamPendingsView(keyName);
    // Click on Claim message and check result
    await t.click(browserPage.claimPendingMessageButton);
    await t.click(browserPage.consumerDestinationSelect);
    await t.expect(browserPage.consumerOption.textContent).notContains(consumerNames[0], 'The currently selected Consumer is not in the drop-down');
});
test('Verify that the message is claimed only if its idle time is greater than the Min Idle Time', async t => {
    keyName = chance.word({ length: 20 });
    consumerGroupName = chance.word({ length: 20 });
    const cliCommands = [
        `XGROUP CREATE ${keyName} ${consumerGroupName} $ MKSTREAM`,
        `XADD ${keyName} * message apple`,
        `XADD ${keyName} * message orange`,
        `XREADGROUP GROUP ${consumerGroupName} Alice COUNT 1 STREAMS ${keyName} >`,
        `XREADGROUP GROUP ${consumerGroupName} Bob COUNT 1 STREAMS ${keyName} >`
    ];
    // Add New Stream Key with pending message
    for(const command of cliCommands){
        await cliPage.sendCommandInCli(command);
    }
    // Open Stream pendings view
    await browserPage.openStreamPendingsView(keyName);
    await t.click(browserPage.fullScreenModeButton);
    const streamMessageBefore = await browserPage.streamMessage.count;
    // Claim message and check result when Min Idle Time is greater than the idle time
    await t.click(browserPage.claimPendingMessageButton);
    await t.typeText(browserPage.streamMinIdleTimeInput, '100000000');
    await t.click(browserPage.submitButton);
    await t.expect(browserPage.notificationMessage.textContent).contains('No messages claimed', 'The message is not claimed notification');
    await t.expect(browserPage.streamMessage.count).eql(streamMessageBefore, 'The number of pendings in the table');
});
test('Verify that when user toggle optional parameters on, he can see optional fields', async t => {
    keyName = chance.word({ length: 20 });
    consumerGroupName = chance.word({ length: 20 });
    const cliCommands = [
        `XGROUP CREATE ${keyName} ${consumerGroupName} $ MKSTREAM`,
        `XADD ${keyName} * message apple`,
        `XADD ${keyName} * message orange`,
        `XREADGROUP GROUP ${consumerGroupName} Alice COUNT 1 STREAMS ${keyName} >`,
        `XREADGROUP GROUP ${consumerGroupName} Bob COUNT 1 STREAMS ${keyName} >`
    ];
    // Add New Stream Key with pending message
    for(const command of cliCommands){
        await cliPage.sendCommandInCli(command);
    }
    // Open Stream pendings view
    await browserPage.openStreamPendingsView(keyName);
    await t.click(browserPage.fullScreenModeButton);
    // Click Claim message with optional parameters and check fields
    await t.click(browserPage.claimPendingMessageButton);
    await t.click(browserPage.optionalParametersSwitcher);
    await t.expect(browserPage.claimIdleTimeInput.visible).ok('The Idle Time field is in optional parameters');
    await t.expect(browserPage.claimRetryCountInput.visible).ok('The Retry Count field is in optional parameters');
    await t.expect(browserPage.claimTimeOptionSelect.visible).ok('The Idle Time Format is in optional parameters');
    await t.expect(browserPage.forceClaimCheckbox.visible).ok('The Force Claim is in optional parameters');
    await t.click(browserPage.claimTimeOptionSelect);
    await t.expect(browserPage.relativeTimeOption.textContent).eql('Relative Time', 'The first option in the time format select list');
    await t.expect(browserPage.timestampOption.textContent).eql('Timestamp', 'The second option in the time format select list');
});
test('Verify that user see the column names in the Pending messages table and navigate by tabs', async t => {
    keyName = chance.word({ length: 20 });
    consumerGroupName = chance.word({ length: 20 });
    const columns = [
        'Entry ID',
        'Last Message Delivered',
        'Times Message Delivered'
    ];
    const cliCommands = [
        `XGROUP CREATE ${keyName} ${consumerGroupName} $ MKSTREAM`,
        `XADD ${keyName} * message apple`,
        `XREADGROUP GROUP ${consumerGroupName} Alice COUNT 1 STREAMS ${keyName} >`
    ];
    // Add New Stream Key with pending message
    for(const command of cliCommands){
        await cliPage.sendCommandInCli(command);
    }
    // Open Stream pendings view and check columns
    await browserPage.openStreamPendingsView(keyName);
    // Click Claim message with optional parameters and check fields
    for(const column of columns){
        await t.expect(browserPage.streamMessagesContainer.textContent).contains(column, `The column name ${column}`);
    }
    // Check navigation
    await t.click(browserPage.streamTabConsumers);
    await t.expect(browserPage.scoreButton.textContent).eql('Consumer Name', 'The Conusmer view is opened');
    await t.click(browserPage.streamTabGroups);
    await t.expect(browserPage.scoreButton.textContent).eql('Group Name', 'The Consumer Groups view is opened');
});
