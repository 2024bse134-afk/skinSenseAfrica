const puppeteer = require('puppeteer');

(async () => {
    // We will launch Chrome and hit http://localhost:3000
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // We want to intercept network requests to log them carefully
    await page.setRequestInterception(true);
    page.on('request', request => {
        request.continue();
    });

    page.on('response', async response => {
        if (response.url().includes('backend-api/v1/assessments')) {
            console.log(`[API RESPONSE] ${response.request().method()} ${response.url()} -> ${response.status()}`);
            if (response.request().method() === 'GET' || response.request().method() === 'POST' || response.request().method() === 'PUT') {
                try {
                    const text = await response.text();
                    console.log(`   DATA: `, text);
                } catch (e) { }
            }
        }
    });

    console.log("Navigating to home...");
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

    console.log("Clicking Start...");
    await page.click('button.btn-primary');

    console.log("Waiting for Assessment ID in URL...");
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    console.log(`URL is now: ${page.url()}`);

    const fileInputSelector = 'input[type="file"]';
    await page.waitForSelector(fileInputSelector);

    console.log("Uploading file...");
    const fileInput = await page.$(fileInputSelector);
    await fileInput.uploadFile('C:/Users/User/.gemini/antigravity/brain/22c68977-3e59-40f7-9962-eea93462db8f/media__1789212024141.png');

    console.log("Waiting for submit photo button...");
    await page.waitForSelector('button.btn-primary', { visible: true });

    // The submit button takes some time to be enabled
    await new Promise(r => setTimeout(r, 1000));

    console.log("Clicking Submit Photo...");
    // Find button containing "Submit Photo"
    const buttons = await page.$$('button.btn-primary');
    for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Submit Photo')) {
            await btn.click();
            break;
        }
    }

    console.log("Waiting for Questionnaire...");
    await page.waitForSelector('select[name="age_group"]');

    console.log("Submitting questionnaire...");
    await page.select('select[name="age_group"]', 'adult');
    const submitQA = await page.$$('button.btn-primary');
    for (const btn of submitQA) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Submit Answers')) {
            await btn.click();
            break;
        }
    }

    console.log("Waiting for result page...");
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    console.log(`URL is now: ${page.url()}`);

    // Wait a bit to catch polling
    console.log("Waiting to see polling / result...");
    await new Promise(r => setTimeout(r, 5000));

    await browser.close();
})();
