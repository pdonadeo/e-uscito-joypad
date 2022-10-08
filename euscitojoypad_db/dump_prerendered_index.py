import asyncio
from pyppeteer import launch

TARGET = "http://localhost:3000/"
#TARGET = "http://localhost:5000/"
#TARGET = "https://www.euscitojoypad.it/"


async def main():
    browser = await launch(headless=False, executablePath="/usr/bin/google-chrome", defaultViewport=None)
    page = await browser.newPage()
    await page.goto(TARGET)
    await asyncio.sleep(5)
    html = await page.content()
    open("prerendered_index.html", "w").write(html)
    await browser.close()


if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
