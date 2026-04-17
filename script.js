// ==UserScript==
// @name         TronClass 通靈神器
// @namespace    Anong0u0
// @version      1.4.3
// @description  這題目我出生前就寫過了
// @author       Anong0u0
// @match        https://tronclass.com.tw/*
// @match        https://eclass.yuntech.edu.tw/*
// @icon         https://eclass.yuntech.edu.tw/static/assets/images/favicon-b420ac72.ico
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_openInTab
// @grant        GM_setClipboard
// @require      https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
// @license      Beerware
// @downloadURL https://update.greasyfork.org/scripts/444084/TronClass%20%E9%80%9A%E9%9D%88%E7%A5%9E%E5%99%A8.user.js
// @updateURL https://update.greasyfork.org/scripts/444084/TronClass%20%E9%80%9A%E9%9D%88%E7%A5%9E%E5%99%A8.meta.js
// ==/UserScript==

// 替換或新增match eclass.yuntech.edu.tw 至其他 domain name
// 即可在任意tronclass網站使用

if (GM_getValue("version") != GM_info.script.version) {
    GM_listValues().forEach((e) => { GM_deleteValue(e) });
    GM_setValue("version", GM_info.script.version);
}

const domainName = location.host;
if (GM_getValue("lastDomainName") != domainName) {
    GM_deleteValue("fullAccessID");
    GM_setValue("lastDomainName", domainName);
}

const session = document.cookie.split('; ').find(row => row.startsWith('session='))?.split('.')[1];
if (GM_getValue("session") != session) {
    GM_deleteValue("profile");
    GM_setValue("session", session);
}


// ====== ↓定義基本function↓ ======

const request = (method, url, data = null, header = {}) => {
    return new Promise((resolve, reject) => {
        var xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        for (const t in header) { xhr.setRequestHeader(t, header[t]) }
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.responseText) : reject(new Error(xhr.responseText));
        xhr.onerror = () => reject(new Error(xhr.responseText));
        xhr.send(data);
    });
}

const delay = (ms = 0) => new Promise(r => setTimeout(r, ms));

function lcsEditDistance(s1, s2) {
    if (s1.length > s2.length) [s1, s2] = [s2, s1];

    const m = s1.length, n = s2.length;
    const dp = Array(m + 1).fill(0);

    for (let j = 1; j <= n; j++) {
        let previous = 0;
        for (let i = 1; i <= m; i++) {
            const temp = dp[i];
            dp[i] = s1[i - 1] === s2[j - 1] ? previous + 1 : Math.max(dp[i], dp[i - 1]);
            previous = temp;
        }
    }

    return m + n - 2 * dp[m];
}

String.prototype.hash = function (shift = 5) {
    const len = this.length;
    let i, hash = 0, ch;
    if (len == 0) return "";
    for (i = 0; i < len; i++) {
        ch = this.charCodeAt(i);
        hash = ((hash << shift) - hash) + ch;
        hash = hash & hash;
    }
    return String(hash);
}
NodeList.prototype.some = Array.prototype.some;
NodeList.prototype.map = Array.prototype.map;
NodeList.prototype.filter = Array.prototype.filter;
Node.prototype.getParentElement = function (times = 0) { let e = this; for (let i = 0; i < times; i++)e = e.parentElement; return e; }
Node.prototype.hash = function () { return this.innerText.replaceAll(/\s|\\/g, '').hash() }
Node.prototype.markAll = function () {
    this.style.color = "var(--primary-button-bg-hover-color)";
    [...this.children].forEach(child => child.markAll());
};

// ====== ↓定義擴充function↓ ======

const cacheGets = {
    fullAccessExamID: async () => {
        const t = GM_getValue("fullAccessID");
        if (t) return t;
        const userID = (await cacheGets.profile()).id;
        for (let id of [...new Set(JSON.parse(await request("GET", `/ntf/users/${userID}/notifications`)).notifications.map((v) => Number(v?.payload?.exam_id)).filter((e) => e))]) {
            try {
                const js = JSON.parse(await request("GET", `/api/exams/${id}`));
                if (js.announce_answer_type && js.is_announce_answer_time_passed) {
                    GM_setValue("fullAccessID", id);
                    return id;
                }
            }
            catch { }
        }
    },
    profile: async () => {
        let t = GM_getValue("profile");
        if (t) return t;
        const { user_no, name, id } = JSON.parse(await request("GET", `/api/profile`));
        t = { user_no, name, id };
        GM_setValue("profile", t);
        return t;
    },
    statsInfo: async (examID) => {
        const t = GM_getValue(`${examID}_stats`, undefined);
        if (t !== undefined) return t;
        const categorizedStats = {
            "填空題": { "易": [], "中": [], "難": [] },
            "單選題": { "易": [], "中": [], "難": [] },
            "複選題": { "易": [], "中": [], "難": [] },
            "是非題": { "易": [], "中": [], "難": [] }
        };
        // const stats = // 保留原始stats
        (await fetch(`/exam/${examID}/export/stat-info`)
            .then(response => response.arrayBuffer())
            .then(data => XLSX.utils.sheet_to_json(XLSX.read(data, { type: "array" }).Sheets["題目統計"])))
            // .map((e)=> ({ 題目: e.題目, 題型: e.題型, 難易度: e.難易度, 各題配分: e.各題配分, 正確答案: e.正確答案 }));
            .forEach((e) => categorizedStats[e.題型]?.[e.難易度]?.push({ 題目: e.題目, 題型: e.題型, 各題配分: e.各題配分, 正確答案: e.正確答案 }));
        GM_setValue(`${examID}_stats`, categorizedStats);
        return categorizedStats;
    },
    examInfo: async (examID) => {
        const t = GM_getValue(examID, {});
        if ("info" in t) return t.info;
        const { submit_end_time, end_time, limit_time, title } = JSON.parse(await request("GET", `/api/exams/${examID}`));
        const info = { submit_end_time, end_time, limit_time, title };
        GM_setValue(examID, { ...t, info });
        return info;
    },
}

const setUpCSSLink = (isGet = false) => {
    if (isGet) {
        let link = [];
        document.querySelectorAll("link[rel='stylesheet']").forEach((e) => {
            if (e.href.indexOf("/static/styles-course") != -1 ||
                e.href.indexOf("/static/styles-lms-main") != -1) link.push(e.href);
        })
        GM_setValue("link", link);
    }
    else {
        GM_getValue("link").forEach((e) => {
            let link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = e;
            document.head.append(link);
        });
    }
}

const subjectType2Input = { 'single_selection': 'radio', 'multiple_selection': 'checkbox', 'true_or_false': 'radio', 'fill_in_blank': 'text', 'short_answer': 'shit', 'analysis': null };
const subjectType2Name = { 'single_selection': '單選題', 'multiple_selection': '多選題', 'true_or_false': '是非題', 'fill_in_blank': '填空題', 'short_answer': '簡答題', 'analysis': "題組" };
const difficultMap = { easy: "易", medium: "中", hard: "難" }
const optionName = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const registeredMenu = [];
const sleepingTest = async (getAllCount = false) => {
    document.body.parentElement.lang = "zh-TW";
    const examID = document.URL.split('/').at(-2),
        pre = document.querySelector("pre"),
        exam = await cacheGets.examInfo(examID),
        globalExamData = GM_getValue(examID, {})
    let subjects = JSON.parse(pre.innerText)?.subjects, lastTimeout = 0;
    const updateExamData = () => {
        clearTimeout(lastTimeout);
        lastTimeout = setTimeout(() => GM_setValue(examID, globalExamData), 1000);
    };
    if (!subjects) {
        alert(`錯誤: ${JSON.parse(pre.innerText).message}`);
        return;
    }
    pre.remove();
    if (getAllCount) {
        window.parent.postMessage({ type: "subjects", size: subjects.length })
        let forceStop = false
        const subjectSet = new Set()
        subjects.forEach((e) => subjectSet.add(e.id))
        const messageFn = (e) => { if (e.data == "stopGetAll") forceStop = true }
        window.addEventListener("message", messageFn)
        while (subjectSet.size < getAllCount) {
            for (let i = 0; i < 52; i++) {
                if (forceStop) break
                await delay(100)
            }
            if (forceStop) break
            const newSubjects = ((await fetch(`/api/exams/${examID}/distribute`).then((e) => e.json())).subjects)
                .filter((e) => !subjectSet.has(e.id))
            if (newSubjects.length == 0) continue
            newSubjects.forEach((e) => subjectSet.add(e.id))
            subjects = subjects.concat(newSubjects)
            console.log(`目前已獲取${subjectSet.size}題`)
            window.parent.postMessage({ type: "subjects", size: subjectSet.size })
        }
        window.removeEventListener("message", messageFn)
    }
    subjects = subjects.sort((a, b) => a.id - b.id).map((e, idx) => { e.sort = idx; return e });//依照題目創立順序(id)排序，而不是server提供的sort

    let needUpdateExamData = false;
    if (!("radio" in globalExamData)) {
        globalExamData.radio = [];
        needUpdateExamData = true;
    }
    if (!("checkbox" in globalExamData)) {
        globalExamData.checkbox = {};
        needUpdateExamData = true;
    }
    if (!("text" in globalExamData)) {
        globalExamData.text = {};
        needUpdateExamData = true;
    }
    if (needUpdateExamData) updateExamData()

    registeredMenu.push(GM_registerMenuCommand("為此考場撈取答案【使用考卷ID】", async () => {
        const submissionID = prompt("請輸入考卷ID");
        if (!submissionID) return;
        if (submissionID != Number(submissionID)) { alert("考卷ID錯誤"); return; }
        const data = JSON.parse(await request("GET", `/api/exams/${await cacheGets.fullAccessExamID()}/submissions/${submissionID}`)).correct_answers_data.correct_answers;
        const allInput = document.querySelectorAll("input");
        if (allInput.some((v) => v.nonce == data[0].subject_id)) {
            for (let ans of data) {
                if (ans.type == "short_answer") continue;
                if (ans.type == "fill_in_blank") {
                    const aip = allInput.filter((v) => v.nonce == ans.subject_id && v.type == "text");
                    ans.correct_answers.forEach((e, index) => {
                        let span = document.createElement("span");
                        span.className = "need-hover";
                        span.innerText = e.content;
                        aip[index].parentElement.append(span);
                    })
                }
                else {
                    let dict = {};
                    ans.answer_option_ids.forEach((e) => { dict[e] = 1 });
                    allInput.forEach((e) => {
                        if (!(e.value in dict)) return;
                        e.getParentElement(2).markAll()
                    });
                }
            }
        }
        else alert("考卷答案與此考場不相符")
    }))

    registeredMenu.push(GM_registerMenuCommand("為此考場撈取答案【使用黑魔法】", async () => {
        console.log("開始撈取答案")
        const categorizedStats = await cacheGets.statsInfo(examID);
        const autoFill = confirm("【請勿濫用】是否自動填入?")

        const subjects = document.querySelectorAll(`[subject]:not([type="題組"]):not([type="簡答題"])`);
        subjects.forEach((subject) => {
            const difficult = subject.getAttribute("difficult");
            const type = subject.getAttribute("type");
            const point = subject.getAttribute("point");
            const title = subject.querySelector("span.subject-description.simditor-viewer").innerText.replace(/[\s\\\n\r]/g, "");
            const statsList = categorizedStats[type][difficult];
            const filteredStats = [];
            let minDistance = 100;

            statsList.forEach((stat, idx) => {
                if (stat.各題配分 != point) return;
                const distance = lcsEditDistance(title, stat.題目);
                if (distance < minDistance) {
                    minDistance = distance;
                    filteredStats.length = 0;
                    filteredStats.push(idx);
                } else if (distance === minDistance) {
                    filteredStats.push(idx);
                }
            });

            filteredStats.forEach((statIdx) => {
                const stat = statsList[statIdx];
                if (stat.題型 === "填空題") {
                    const inputs = subject.querySelectorAll("input");
                    stat.正確答案.split(/\s*\(\d+\)/g).slice(1).forEach((e, idx) => {
                        const span = document.createElement("span");
                        span.className = "need-hover";
                        span.innerText = e;
                        inputs[idx].parentElement.append(span);
                        if (autoFill) {
                            inputs[idx].value = e.trim();
                            inputs[idx].dispatchEvent(new Event("input"))
                        }
                    });
                }
                else {
                    let choose = null;
                    switch (stat.題型) {
                        case "單選題":
                        case "是非題":
                            choose = subject.querySelector(`[option="${stat.正確答案}"]`)
                            choose.markAll();
                            if (autoFill) choose.firstElementChild.click();
                            break;
                        case "複選題":
                            if (autoFill) subject.querySelectorAll("input").forEach((e) => e.checked = false);
                            [...stat.正確答案].forEach((option) => {
                                subject.querySelector(`[option="${option}"]`).markAll();
                                if (autoFill) {
                                    choose = subject.querySelector(`[option="${option}"] input`)
                                    choose.checked = true;
                                    choose.dispatchEvent(new Event("click"));
                                }
                            });
                            break;
                    }
                }
                delete statsList[statIdx];
            });
            if (filteredStats.length > 1) {
                const span = document.createElement("span");
                span.className = "need-hover-li";
                span.innerText = "同題目多個答案，請自行判斷";
                subject.querySelector(".summary-sub-title").append(span);
            }
            categorizedStats[type][difficult] = statsList.filter((e) => e !== undefined);
        });
        console.log("答案撈取完成")
    }))

    setUpCSSLink();

    let baseDiv = document.createElement("div"), totalCount = subjects.length;
    baseDiv.className = "main-content";
    baseDiv.innerHTML = `
    <style>
        .need-hover, .need-hover-li {
            opacity: 0.3;
            display: none;
        }
        :hover > .need-hover, li[subject]:hover .need-hover-li {
            display: inline;
        }
    </style>
    <div class="exam-activity-container">
        <div class="hd">
            <div class="left">
                <span class="exam-title left">${exam.title}</span>
                <span class="left-time-wrapper">
                    <span class="left-time-label">剩餘時間：</span>
                    <span class="left-time">00:00</span>
                </span>
            </div>
            <div class="right">
                <span class="exam-progress-wrapper">
                    <span class="progress-label">答題進度: <span class="answered-subjects">0</span>/${totalCount}</span>
                    <span class="progress radius"><span class="meter" style="width: 0%;"></span></span>
                </span>
                <a class="button full-screen-header-button button-green" onclick="window.parent.postMessage('closeIframe')">交卷</a>
            </div>
        </div>

        <div class="bd"><div class="exam-area row"><div class="exam-area-content">
            <div class="exam-paper">
                <div class="paper-content card">
                    <ol class="subjects-jit-display">

                    </ol>
                </div>
                <div class="paper-footer"><a class="button button-green" onclick="window.parent.postMessage('closeIframe')">結束通靈</a></div>
            </div>
        </div></div></div>
    </div>`;
    document.body.append(baseDiv);
    let percent = document.querySelector("span.meter"),
        answered = document.querySelector("span.answered-subjects"),
        answeredCount = 0,
        answeredDict = {};
    const checkAnswered = (subjectID) => {
        if (!(subjectID in answeredDict)) {
            answeredDict[subjectID] = 1
            percent.style.width = `${++answeredCount * 100 / totalCount}%`;
            answered.innerText = answeredCount;
        }
    }

    const putSubject = (subjects, whichAppend, appendTo, isSub = false) => {
        subjects.forEach((e) => {
            if (!(e.type in subjectType2Input)) return;
            const inputType = subjectType2Input[e.type];
            let baseLi = document.createElement("li");
            baseLi.setAttribute("difficult", difficultMap[e.difficulty_level])
            baseLi.setAttribute("point", e.point)
            baseLi.setAttribute("type", e.type == "multiple_selection" ? "複選題" : subjectType2Name[e.type])
            baseLi.setAttribute("subject", "")
            if (!isSub) {
                baseLi.className += "subject";
                baseLi.innerHTML = `
                <div class="subject-head">
                    <div class="summary-title">
                        <div class="subject-resort-index">${e.sort + 1}.</div>
                        <span class="subject-description simditor-viewer">${e.description}</span>
                    </div>
                    <div class="summary-sub-title"><span class="subject-point">${subjectType2Name[e.type]} (${Number(e.point)} 分)${inputType == "text" ? '<span class="sub-title-hint">(請依照題目中的填空位置依次填寫答案)</span>' : ''}</span></div>
                </div>
                <div class="subject-body"></div>`;
            }
            else {
                baseLi.className += "sub-subject-content";
                baseLi.innerHTML = `
                <div class="sub-subject">
                    <div class="subject-head">
                        <div class="summary-title">
                            <div class="subject-resort-index">(${e.sort + 1})</div>
                            <span class="subject-description simditor-viewer">${e.description}</span>
                        </div>
                        <div class="summary-sub-title"><span class="subject-point">${subjectType2Name[e.type]} (${Number(e.point)} 分)${inputType == "text" ? '<span class="sub-title-hint">(請依照題目中的填空位置依次填寫答案)</span>' : ''}</span></div>
                    </div>
                    <div class="subject-body"></div>
                </div>`;
            }

            if (inputType == "text") {
                let nli = document.createElement("div");
                nli.className = "answer-content";
                const ans = `<li class="answer"><input class="content" type="text" nonce=${e.id}></li>`;
                nli.innerHTML = `<ol class="subject-answers">${ans.repeat(e.answer_number ? e.answer_number : 1)}</ol>`;
                const allInput = nli.querySelectorAll("input");
                allInput.forEach((inp) => {
                    inp.addEventListener("input", (ip) => {
                        const examDesc = ip.target.getParentElement(5).querySelector("span.subject-description.simditor-viewer").hash();
                        globalExamData.text[examDesc] = allInput.map((i) => i.value)
                        updateExamData();
                        checkAnswered(examDesc);
                    })
                })
                baseLi.querySelector("div.subject-body").append(nli);
            }
            else if (inputType == "shit") {
                let nli = document.createElement("div");
                nli.className = "answer-content";
                nli.innerHTML = `<p>這是一題主觀批改的簡答題，無法通靈作答<br>請詳讀題目，並前往正式作答努力<br>自求多福。</p>`;
                baseLi.querySelector("div.subject-body").append(nli);
            }
            else if (e.options.length != 0) {
                let nli = document.createElement("ol");
                nli.className = "subject-options";
                e.options.sort(((a, b) => { return a.original_sort - b.original_sort })) //使選項依照原始排序，而不是server隨機
                e.options.forEach((opt, index) => {
                    let t = document.createElement("li");
                    t.className = "option";
                    t.setAttribute("option", optionName[index])
                    t.innerHTML = `
                    <label>
                        <span class="left">
                            <input type="${inputType}" value="${opt.id}" nonce="${e.id}">
                            <span class="option-index">${optionName[index]}.</span>
                        </span>
                        <div class="option-content"><span class="simditor-viewer">${opt.content}</span></div>
                    </label>`;
                    nli.append(t);
                })
                const allInput = nli.querySelectorAll("input");
                if (inputType == "radio") {
                    allInput.forEach((btn) => {
                        btn.addEventListener("click", (bt) => {
                            bt = bt.target;
                            const dict = {};
                            allInput.forEach((e) => { e.checked = false; dict[e.value] = 0 })
                            bt.checked = true;
                            globalExamData.radio = globalExamData.radio.filter((v) => !(v in dict))
                            globalExamData.radio.push(bt.value)
                            updateExamData();
                            checkAnswered(bt.nonce);
                        })
                    })
                }
                else {
                    allInput.forEach((btn) => {
                        btn.addEventListener("click", (bt) => {
                            bt = bt.target;
                            const examDesc = bt.getParentElement(6).querySelector("span.subject-description.simditor-viewer").hash();
                            globalExamData.checkbox[examDesc] = allInput.filter((i) => i.checked).map((i) => i.getParentElement(2).querySelector("span.simditor-viewer").hash());
                            updateExamData();
                            checkAnswered(bt.nonce);
                        })
                    })
                }
                baseLi.querySelector("div.subject-body").append(nli);
            }
            else if (e.sub_subjects.length != 0) {
                let ol = document.createElement("ol");
                ol.className = "sub-subjects";
                putSubject(e.sub_subjects, ol, null, true)
                baseLi.querySelector("div.subject-body").append(ol);
            }
            if (appendTo) whichAppend.querySelector(appendTo).append(baseLi);
            else whichAppend.append(baseLi);
            if (!isSub) console.log(baseLi)
        })
    }
    putSubject(subjects, baseDiv, "ol.subjects-jit-display")

    delay(500).then(() => {
        const dict = {};
        globalExamData.radio.forEach((e) => { dict[e] = 1 })
        document.querySelectorAll("input").forEach((e) => {
            if (e.type != "text") {
                if (e.type == "radio") {
                    if (e.value in dict) {
                        e.checked = true;
                        checkAnswered(e.nonce);
                    }
                }
                else {
                    const examDesc = e.getParentElement(6).querySelector("span.subject-description.simditor-viewer").hash();
                    if (examDesc in globalExamData.checkbox && globalExamData.checkbox[examDesc].indexOf(e.getParentElement(2).querySelector("span.simditor-viewer").hash()) != -1) {
                        e.checked = true;
                        checkAnswered(e.nonce);
                    }
                }
            }
            else {
                const examDesc = e.getParentElement(5).querySelector("span.subject-description.simditor-viewer").hash();
                if (examDesc in globalExamData.text) {
                    let t = globalExamData.text[examDesc], event = new Event("input");
                    dict[examDesc] = examDesc in dict ? dict[examDesc] + 1 : 0;
                    e.value = t[dict[examDesc]];
                    // e.dispatchEvent(event);
                    checkAnswered(examDesc);
                }
            }
        })
    })

    delay().then(async () => {
        let time = document.querySelector("span.left-time"), sec, ori;
        ori = Math.min(...[exam.limit_time * 60, Math.floor((Date.parse(exam.end_time) + 28800 - Date.now()) / 1000), Math.floor((Date.parse(exam.submit_end_time) + 28800 - Date.now()) / 1000)].filter((e) => e))
        sec = ori;
        setInterval(() => {
            if (--sec == 0) sec = ori;
            let M = Math.floor(sec / 60),
                S = sec - M * 60;
            time.innerText = `${String(M).padStart(2, '0')}:${String(S).padStart(2, '0')}`;
        }, 1000)
    })

    cacheGets.profile().then((data) => {
        const wmDiv = document.createElement("div")
        var n = document.createElement("canvas")
        n.width = 300
        n.height = 140
        var r = n.getContext("2d");
        r.rotate(-28 * Math.PI / 180)
        r.font = "14px PingFang SC"
        r.fillStyle = "rgba(0, 0, 0, 0.12)"
        r.textAlign = "center"
        r.textBaseline = "middle"
        for (var o = [data.name, data.user_no], l = 0; l < o.length; l++) r.fillText(o[l], 100, 140 + 16 * l)
        wmDiv.style = `pointer-events: none;inset: 0px;position: fixed;z-index: 100000;background: url(${n.toDataURL("image/png", 1)}) left top repeat;`
        document.body.append(wmDiv)
    })

    delay(500).then(() => window.parent.postMessage('initDone'))
}

// ====== ↓ 進入點Main ↓ ======

if (document.URL.indexOf("/distribute?skejtofg84weh=") != -1) { sleepingTest(document.URL.split("=").at(-1)); return; }
if (document.URL.indexOf("/distribute") != -1) { sleepingTest(); return; }

const waitElementLoad = (elementSelector, selectCount = 1, tryTimes = 1, interval = 0, baseElement = null) => {
    return new Promise(async (resolve, reject) => {
        let t = 1, result;
        if (baseElement == null) baseElement = document
        while (true) {
            if (selectCount != 1) { if ((result = baseElement.querySelectorAll(elementSelector)).length >= selectCount) break; }
            else { if (result = baseElement.querySelector(elementSelector)) break; }

            if (tryTimes > 0 && ++t > tryTimes) return reject(new Error("Wait Timeout"));
            await delay(interval);
        }
        resolve(result);
    })
}

const downloadExam = async () => {
    if (!confirm("請勿濫用，是否繼續下載?")) return;
    const id = document.URL.split('/').pop();
    const download = () => {
        GM_openInTab(`https://${location.host}/api/uploads/${js.paper_zip.id}/blob`);
        if (confirm("下載完成，是否刪除下載紀錄?\n(再次下載需要重新等待)")) request("delete", `/api/uploads/${js.paper_zip.id}?no-intercept=true`).then((e) => { alert("刪除紀錄成功") });
    }
    const wait = async () => {
        let first = true;
        while (true) {
            js = JSON.parse(await request("GET", `/api/exams/${id}/zip-status?no-intercept=true`));
            if (js.paper_zip.status === "ready") break;
            if (first) { alert("開始請求下載，可能需要幾分鐘等待時間...\n等待訊息記錄在console"); first = false; }
            console.log("等待下載中...");
            await delay(3000);
        }
        download();
    }
    let js = JSON.parse(await request("GET", `/api/exams/${id}/zip-status?no-intercept=true`));
    if (js.paper_zip) {
        if (js.paper_zip.status === "ready") download();
        else wait();
    }
    else request("POST", `/api/exams/${id}/zip-papers`).then(() => { wait() }).catch((e) => alert(JSON.parse(e.message)?.message))
}

let sleeptestLock = false
const initIframe = (getAll = false) => {
    let style = document.createElement("style"),
        iframe = document.createElement("iframe");
    style.innerHTML = `html{overflow:-moz-hidden-unscrollable;height:100%;}body::-webkit-scrollbar{display:none;}body{-ms-overflow-style:none;height:100%;width:calc(100vw+18px);overflow:auto;}`;
    iframe.style = "border: 0;position: fixed;top: 0;left: 0;z-index: 114514;width: 100vw;height: 100vh";
    iframe.hidden = true;
    iframe.src = getAll ? `/api/exams/${document.URL.split('/').pop()}/distribute?skejtofg84weh=${getAll}` : `/api/exams/${document.URL.split('/').pop()}/distribute`;
    iframe.id = "sleeptest";
    document.body.append(iframe);

    const windowMessage = (e) => {
        if (e.data == "closeIframe") {
            window.removeEventListener('message', windowMessage);
            style.remove()
            iframe.remove()
            registeredMenu.forEach((e) => GM_unregisterMenuCommand(e))
            registeredMenu.length = 0
            sleeptestLock = false
        }
        else if (e.data == "initDone") {
            iframe.hidden = false;
            document.body.append(style);
            delay(250).then(() => alert("目前為通靈狀態，在這裡僅儲存作答結果\n可以隨意切換視窗，不受考試時間限制\n(不包含測驗截止時間，頂部剩餘時間為裝飾用)\n在進入正式作答後，所作答案會自動填上"))
        }
    }
    window.addEventListener('message', windowMessage);
}

const simulateGacha = (n, k, simulations = 5000) => {
    let totalDraws = 0;
    const arr = Array(n).fill().map((_, i) => i)
    for (let i = 0; i < simulations; i++) {
        const drawnItems = new Set();
        let draws = 0;
        while (drawnItems.size < n) {
            draws++;
            const n = arr.length;
            for (let i = 0; i < k; i++) {
                const j = i + Math.floor(Math.random() * (n - i));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            for (let item of arr.slice(0, k)) drawnItems.add(item);
        }
        totalDraws += draws;
    }
    return totalDraws / simulations;
}

var oldHref = null;
new MutationObserver(async () => // onUrlChange
{
    if (oldHref == document.location.href) return;
    oldHref = document.location.href;

    if (document.URL.indexOf("#/exam/") != -1) {
        waitElementLoad("li.profile > .dropdown-list li:nth-child(3)", 1, 20, 100)
            .then((e) => { if (e.innerText.trim() != "繁體中文") return waitElementLoad("li.profile > .dropdown-list li:nth-child(3) > ul.second-level a[ng-click]", 5, 20, 100, e); else throw "nope" })
            .then((langs) => { [...langs].find((a) => a.innerText.trim() == "繁體中文").click() }).catch(() => { })

        const examID = document.URL.split("/").pop();
        const exportHistory = () => {
            const { radio, checkbox, text } = GM_getValue(examID, {});
            GM_setClipboard(JSON.stringify({ exam_id: examID, radio, checkbox, text }))
            alert(`已複製 考場ID: ${examID} 的通靈紀錄至剪貼簿`);
        }
        const importHistory = () => {
            const data = prompt("請輸入通靈紀錄");
            if (!data) return;
            const t = GM_getValue(examID, {});
            const { radio, checkbox, text, exam_id } = JSON.parse(data);
            if (!exam_id) { alert("匯入失敗，exam_id遺失"); return; }
            GM_setValue(exam_id,
                {
                    ...t,
                    radio: [...new Set([...(t.radio || []), ...(radio || [])])],
                    checkbox: { ...(t.checkbox || {}), ...(checkbox || {}) },
                    text: { ...(t.text || {}), ...(text || {}) }
                });
            alert("已匯入通靈紀錄");
        }
        GM_registerMenuCommand("【已失效】下載此考場之考卷", downloadExam);
        GM_registerMenuCommand("分享通靈紀錄", exportHistory);
        GM_registerMenuCommand("匯入通靈紀錄", importHistory);
        const bd = (await waitElementLoad("div.bd > div.exam-button-container", 1, 20, 300).catch(() => { GM_deleteValue(examID) })).parentElement;
        const container = document.createElement("div");
        container.className = "exam-button-container";
        container.innerHTML = `
        <style>
            a.button{border: none;}
            a.button-purple{background-color: MediumOrchid;color:white;}
            a.button-purple:hover{background-color: DarkOrchid;color:white}
            .progress-bar {
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                overflow: hidden;
                background-color: rgba(255, 255, 255, 0.2);
                width: 0%;
                transform: translateZ(0);
                transition: width 1s ease;
            }
            .scan-bar {
                position: absolute;
                top: 0;
                left: -100%;
                height: 100%;
                width: 10px;
                background-color: rgba(255, 255, 255, 0.3);
                animation: scan 2s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
            }
            @keyframes scan {
                0% {
                    left: -100%;
                }
                100% {
                    left: 100%;
                }
            }
            .noanimated {transition: none;}
        </style>
        <a class="button button-purple take-exam" id="sleeptest">
            開始通靈
        </a>
        <a class="button button-purple take-exam animated" id="sleeptestall">
            <span class="progress-bar"><span class="scan-bar"></span></span>
            <span class="text">通靈所有題目</span>
            <span class="ETA"></span>
        </a>
        <a class="button button-red take-exam" style="display:none">
            中止(載入目前題目)
        </a>`;
        bd.append(container);
        bd.querySelector("a.button.button-green.take-exam > span").innerText = "正式作答";

        const stopBtn = bd.querySelector("a.button.button-red.take-exam"),
            progressBar = bd.querySelector('.progress-bar'),
            btn = bd.querySelector("#sleeptestall > span.text"),
            ETA = bd.querySelector("#sleeptestall > span.ETA")
        bd.querySelector("#sleeptest").onclick = () => {
            if (sleeptestLock) return;
            sleeptestLock = true
            initIframe()
        }
        bd.querySelector("#sleeptestall").onclick = async () => {
            if (sleeptestLock) return;
            sleeptestLock = true
            const { subjects_count, subjects_rule } = await fetch(`/api/exams/${examID}`).then(r => r.json())
            const categorizedStats = await cacheGets.statsInfo(examID);
            let allCount = 0;
            ["填空題", "單選題", "複選題", "是非題"].forEach((type) =>
                ["易", "中", "難"].forEach((difficult) => { allCount += categorizedStats[type][difficult].length })
            )
            const gachaTimes_single = simulateGacha(allCount, subjects_count)

            const subjectCount = {}, difficultMap = { 3: "易", 2: "中", 1: "難" };
            ["fill_in_blank", "single_selection", "multiple_selection", "true_or_false"].forEach((type) => {
                const difficults = {};
                subjects_rule?.select_subjects_randomly_rule?.[0][type]?.forEach((e) => difficults[difficultMap[e.subject_difficulty_level]] = e.subjects_count);
                subjectCount[type == "multiple_selection" ? "複選題" : subjectType2Name[type]] = difficults;
            })
            const gachaTimes_multi = Math.max(...["填空題", "單選題", "複選題", "是非題"].map((type) =>
                ["易", "中", "難"].map((difficult) => {
                    const n = categorizedStats[type][difficult].length
                    if (n === 0) return
                    const k = subjectCount[type][difficult]
                    if (k === 0) return
                    const needTimes = simulateGacha(n, k)
                    return needTimes
                })
            ).flat().filter((e) => e))

            let percent = 0;
            const startTime = Date.now(), estimatedEndTime = Math.ceil((gachaTimes_single + gachaTimes_multi) / 1.75) * 5500 * 2;
            const interval = setInterval(() => {
                const endTime = startTime + estimatedEndTime
                const remainingTime = endTime - Date.now()
                if (remainingTime <= 0) {
                    ETA.innerText = "ETA: 應該快好了...? 😰"
                    return clearInterval(interval)
                }
                const remainingHours = Math.floor(remainingTime / 3600000)
                const remainingMinutes = Math.floor(remainingTime % 3600000 / 60000)
                const remainingSeconds = Math.floor(remainingTime % 60000 / 1000)
                if (remainingTime < 3600000) ETA.innerText = `ETA: ${String(remainingMinutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
                else ETA.innerText = `ETA: ${String(remainingHours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
            }, 1000)
            const messageFn = (e) => {
                if (e.data.type !== 'subjects') return;
                percent = e.data.size / allCount * 100;
                progressBar.style.width = `${percent}%`;
                btn.innerText = `(${percent.toFixed(0)}%) ${e.data.size}/${allCount}`;
                if (percent >= 100) stopBtn.onclick()
            }
            stopBtn.onclick = () => {
                document.querySelector("iframe#sleeptest").contentWindow.postMessage("stopGetAll");
                clearInterval(interval)
                stopBtn.style.display = "none";
                progressBar.classList.add('noanimated');
                progressBar.style.width = '0%';
                btn.innerText = '通靈所有題目';
                ETA.innerText = '';
                requestAnimationFrame(() => progressBar.classList.remove('noanimated'));
            }
            stopBtn.style = "";
            initIframe(allCount);
            window.addEventListener('message', messageFn)
        }
        setUpCSSLink(true);
        cacheGets.fullAccessExamID()
    }
    if (document.URL.indexOf("/subjects#/take") != -1) {
        await waitElementLoad("input.ng-scope", 1, 0, 500);
        await delay(500);
        let data = GM_getValue(document.URL.split("/").find((v) => Number(v))), dict = {};
        data.radio.forEach((e) => { dict[e] = 1 });
        document.querySelectorAll("ol.subjects-jit-display input").forEach((e) => {
            if (e.type != "text") {
                if (e.type == "radio") { if (e.value in dict) e.click(); }
                else {
                    const examDesc = e.getParentElement(6).querySelector("span.subject-description.simditor-viewer").hash();
                    if (examDesc in data.checkbox && data.checkbox[examDesc].indexOf(e.getParentElement(2).querySelector("span.simditor-viewer").hash()) != -1) {
                        e.checked = false;
                        e.click();
                    }
                }
            }
            else {
                const examDesc = e.getParentElement(5).querySelector("span.subject-description.simditor-viewer").hash();
                if (examDesc in data.text) {
                    let t = data.text[examDesc], event = new Event("input");
                    dict[examDesc] = examDesc in dict ? dict[examDesc] + 1 : 0;
                    e.value = t[dict[examDesc]];
                    e.dispatchEvent(event);
                }
            }
        })
    }
}).observe(document.body, { childList: true, subtree: true });


/*
GM_Storage
{
    version: script's version,
    lastDomainName: domainName,
    link: [...CSS link],
    fullAccessID: User's FullAccessExamID,

    ...examID:
    {
        radio: [...OptionID],
        checkbox:
        {
            ...ExamDescriptionHash: [...OptionDescriptionHash],
        },
        text:
        {
            ...ExamDescriptionHash: [...answer]
        },
        info:
        {
            submit_end_time,
            end_time,
            limit_time,
            title
        },
    },

    ${examID}_stats:
    {
        [...type]: { [...difficult]: [...subject] }
        // type = 填空題,單選題,複選題,是非題
        // difficult = 易,中,難
        // subject = { 題目, 題型(type), 各題配分, 正確答案 }
    },

    profile:
    {
        name,
        user_no,
        id
    }
}
*/