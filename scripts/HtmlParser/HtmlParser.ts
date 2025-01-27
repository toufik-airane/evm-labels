import * as cheerio from "cheerio";
import type { BrowserContext, Page } from "playwright";
import type { AccountRows, TokenRows } from "../AnyscanPuller";
import type { ApiParser } from "../ApiParser/ApiParser";
import { EtherscanApiParser } from "../ApiParser/EtherscanApiParser";
import { sleep } from "../utils/sleep";

export abstract class HtmlParser {
  /**
   * Find all the label urls on a labelcloud page
   * @param html - the labelcloud page content
   * @param baseUrl - the "scan" of interest.
   * @example
   * ```ts
   *  const allAnchors = htmlParser.selectAllLabels(
   *    labelCloudHtml
   * );
   * ```
   */
  #useApiForTokenRows: boolean = false;
  public setUseApiForTokenRows(useApiForTokenRows: boolean): void {
    this.#useApiForTokenRows = useApiForTokenRows;
  }
  public getUseApiForTokenRows(): boolean {
    return this.#useApiForTokenRows;
  }

  public selectAllLabels = (html: string): ReadonlyArray<string> => {
    const $ = cheerio.load(html);
    const parent = $("div > div > div.row.mb-3");

    let anchors: ReadonlyArray<string> = [];
    parent.find("a").each((index, element) => {
      const pathname = $(element).attr("href");
      if (typeof pathname !== "string") {
        console.log(`returning early because "${pathname}" is not a string`);
        return;
      }
      // tokens has a max page size of 100 while accounts seems to allow 10,000+
      // TODO: repull tokens which have a page length > 100
      const maxRecordsLength = pathname.includes("tokens") ? 100 : 10_000;
      const size = $(element).text();
      const regex = /\((.*?)\)/;
      const recordCount = Number(regex.exec(size)?.[1]);
      // if statement needed because otherwise we freeze forever on URL's like "beacon-depositor"
      if (recordCount < maxRecordsLength) {
        const href = `${pathname}?size=${maxRecordsLength}`;
        anchors = [...anchors, href];
      }
    });
    return anchors;
  };

  public async selectAllTokenAddressesApi(
    page: Page,
    url: string,
    subcatId: string,
  ): Promise<TokenRows> {
    const context: BrowserContext = page.context();
    const cookies = await context.cookies();
    const cookiesString: string = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
    const baseUrl = url.split("/").slice(0, 3).join("/");
    const tokenName = `/${url.split("/").slice(3).join("/")}`;

    const apiParser: ApiParser = new EtherscanApiParser(baseUrl);
    const tokenRows = await apiParser.fetchTokens(
      tokenName,
      cookiesString,
      page,
      subcatId,
    );
    const sleepTime = Math.floor(Math.random() * 2000) + 1000; // Random time between 1 and 3 seconds in milliseconds
    await sleep(sleepTime);
    return tokenRows;
  }

  public abstract selectAllTokenAddresses(html: string): TokenRows;

  public abstract selectAllAccountAddresses(
    html: string,
    subcatId: string,
  ): AccountRows;
}
