// Function that scrapes the tailwind website

async function scrapeTailWind() {
    const map = {};
    const sleep = (m) => new Promise((r) => setTimeout(r, m));
    const navElems = document.getElementsByClassName(
        'px-2 -mx-2 py-1 transition duration-200 ease-in-out relative block hover:translate-x-2px hover:text-gray-900 text-gray-600 font-medium'
    );
    for (let i = 20; i < navElems.length; i++) {
        const elem = navElems[i];
        elem.click();
        await sleep(2000);
        const tableBody = document.querySelector('tbody');
        if (!tableBody) {
            continue;
        }
        const rows = Array.from(tableBody.getElementsByTagName('tr'));
        if (rows) {
            rows.forEach((tr) => {
                const tds = tr.children;
                const ths = document.getElementsByTagName('th');
                if (ths.length <= 2) {
                    let style = tds[1].innerText.replace(/\s/g, '').split(';');
                    if (style && style.length && style.length < 3) {
                        style = style[0].split(':');
                        if (!map[style[0]]) {
                            map[style[0]] = {};
                        }
                        map[style[0]][style[1]] = tds[0].innerText;
                    } else {
                        console.log(style);
                    }
                }
            });
        }
    }
    console.log(JSON.stringify(map));
    return map;
}
scrapeTailWind();
