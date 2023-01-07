const puppeteer = require("puppeteer");
const json2xls = require("json2xls");
const fs = require("fs");
const cheerio = require("cheerio");

const url = "https://yokatlas.yok.gov.tr/netler.php";

const data = [];
const thElements = [];
let a = 0;

async function scrapeData() {
  // Launch a headless browser
  const browser = await puppeteer.launch({ headless: true });

  // Go to the webpage
  const page = await browser.newPage();
  await page.goto(url);

  // Evaluate the values of the "bolum" and "program" elements
  const bolumValues = await page.evaluate(() => {
    const values = [];
    const options = document.querySelectorAll("#bolum option");
    options.forEach((option) => {
      values.push(option.value);
    });
    return values;
  });
  const programValues = await page.evaluate(() => {
    const values = [];
    const options = document.querySelectorAll("#program option");
    options.forEach((option) => {
      values.push(option.value);
    });
    return values;
  });

  // Combine the values into a single array
  const values = [...bolumValues, ...programValues];

  // Scrape the data from each webpage
  for (const value of values) {
    let url;

    if (!value) {
      // value is blank, skip this iteration
      continue;
    }

    if (bolumValues.includes(value)) {
      url = `https://yokatlas.yok.gov.tr/netler-tablo.php?b=${value}`;
    } else {
      url = `https://yokatlas.yok.gov.tr/netler-onlisans-tablo.php?b=${value}`;
    }
    console.log(`Scraping data from ${url}...`);

    await page.goto(url);
    const html = await page.content();
    const $ = cheerio.load(html);

    // Select 100 rows per page
    try {
      await page.waitForSelector('select[name="mydata_length"]', {
        timeout: 30000,
      });
      await page.select('select[name="mydata_length"]', "100");
    } catch (error) {
      console.error(error);
    }

    // Scrape data from the current page
    scrapePageData(page, data, $);

    // Get the next button element
    let nextButton = await page.$(".pagination li.next");

    // As long as the next button exists, click on it and scrape the data
    while (nextButton) {
      // Check if the next button is disabled
      const classes = await page.evaluate(
        (nextButton) => nextButton.getAttribute("class"),
        nextButton
      );
      if (classes.includes("disabled")) {
        break;
      }

      // Click on the next button
      await nextButton.click();

      // Wait for the table rows to load
      await page.waitForSelector(".table tbody tr");

      // Scrape the data from the page
      scrapePageData(page, data, $);

      // Get the next button element again
      nextButton = await page.$(".pagination li.next");
    }
  }

  console.log("DATA IS ARRAY: ", Array.isArray(data));
  console.log("DATA LENGTH: ", data.length);

  console.log("TH ELEMENTS: ", thElements);
  console.log("TH ELEMENTS LENGTH: ", thElements.length);
  console.log("TH ELEMENTS IS ARRAY: ", Array.isArray(thElements));

  const xls = json2xls([thElements, ...data]);
  fs.writeFileSync("data.xlsx", xls, "binary");

  console.log("DONE! You can find the data in data.xlsx");
  console.log("You can close this window now.");

  // Close the browser
  await browser.close();
}

scrapeData();

async function scrapePageData(page, data, $) {
  const html = await page.content();
  $ = cheerio.load(html);
  const rows = $(".table tbody tr");
  rows.each((i, row) => {
    const tds = $(row).find("td");
    const item = {};
    tds.each((j, td) => {
      item[j] = $(td).text().trim();
    });
    data.push(item);
  });
  console.log("DATA LENGTH: ", data.length);

  console.log("A is: ", a);
  if (a < 1) {
    // Get the column headers
    $('tr[role="row"] th').each((i, element) => {
      thElements.push($(element).text().trim());
    });
    console.log("TH ELEMENTS: ", thElements);
    console.log("TH ELEMENTS LENGTH: ", thElements.length);
    console.log("TH ELEMENTS IS ARRAY: ", Array.isArray(thElements));
  }
  a++;
}
