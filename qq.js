"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");
const CryptoJs = require("crypto-js");
const he = require("he");
const pageSize = 20;
function formatMusicItem(_) {
    var _a, _b, _c;
    const albumid = _.albumid || ((_a = _.album) === null || _a === void 0 ? void 0 : _a.id);
    const albummid = _.albummid || ((_b = _.album) === null || _b === void 0 ? void 0 : _b.mid);
    const albumname = _.albumname || ((_c = _.album) === null || _c === void 0 ? void 0 : _c.title);
    return {
        id: _.id || _.songid,
        songmid: _.mid || _.songmid,
        media_mid:
            _.media_mid ||
            _.mediaMid ||
            (_.file && _.file.media_mid) ||
            undefined,
        file: _.file || undefined,
        pay: _.pay || undefined,
        title: _.title || _.songname,
        artist: (Array.isArray(_.singer) ? _.singer : []).map((s) => s.name).filter(Boolean).join(", "),
        artwork: albummid
            ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg`
            : undefined,
        album: albumname,
        lrc: _.lyric || undefined,
        albumid: albumid,
        albummid: albummid,
    };
}
function formatAlbumItem(_) {
    return {
        id: _.albumID || _.albumid,
        albumMID: _.albumMID || _.album_mid,
        title: _.albumName || _.album_name,
        artwork: _.albumPic ||
            `https://y.gtimg.cn/music/photo_new/T002R300x300M000${_.albumMID || _.album_mid}.jpg`,
        date: _.publicTime || _.pub_time,
        singerID: _.singerID || _.singer_id,
        artist: _.singerName || _.singer_name,
        singerMID: _.singerMID || _.singer_mid,
        description: _.desc,
    };
}
function formatArtistItem(_) {
    return {
        name: _.singerName,
        id: _.singerID,
        singerMID: _.singerMID,
        avatar: _.singerPic,
        worksNum: _.songNum,
    };
}
const searchTypeMap = {
    0: "song",
    2: "album",
    1: "singer",
    3: "songlist",
    7: "song",
    12: "mv",
};
const headers = {
    referer: "https://y.qq.com",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
    Cookie: "uin=",
};
const validSongFilter = (item) => {
    const pay = (item && item.pay) || {};

    // 鏃ф帴鍙ｆ湁 pay_play / payplay锛涙柊鎺ュ彛瀛楁涓嶅畬鏁存椂涓嶈鎶婃瓕鏇插叏閮ㄨ繃婊ゆ帀銆�
    if (pay.pay_play === undefined && pay.payplay === undefined) {
        return true;
    }

    return pay.pay_play === 0 || pay.payplay === 0;
};

async function searchBase(query, page, type) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeType = Number(type) || 0;
    const keyword = String(query || "").trim();
    const searchId = String(Math.floor(Math.random() * 90000000000000000) + 10000000000000000);

    const request = async (payload) => {
        return (await (0, axios_1.default)({
            url: "https://u.y.qq.com/cgi-bin/musicu.fcg",
            method: "POST",
            data: payload,
            headers: Object.assign(Object.assign({}, headers), {
                "Content-Type": "application/json;charset=UTF-8",
                Accept: "application/json, text/plain, */*",
            }),
            timeout: 15000,
            xsrfCookieName: "XSRF-TOKEN",
            withCredentials: true,
        })).data;
    };

    const getList = (response, mode) => {
        const blocks = [];
        if (response) {
            blocks.push(response["music.search.SearchCgiService.DoSearchForQQMusicDesktop"]);
            blocks.push(response["music.search.SearchCgiService.DoSearchForQQMusicMobile"]);
            blocks.push(response["music.search.SearchCgiService"]);
            blocks.push(response.req_1);
            blocks.push(response.req);
            blocks.push(response.req_0);
        }

        for (const block of blocks) {
            if (!block) continue;
            const data = block.data || {};
            const body = data.body || {};
            const key = searchTypeMap[safeType] || "song";
            const candidates = [
                body[key],
                body[`item_${key}`],
                body.song,
                body.item_song,
            ];

            for (const node of candidates) {
                if (node && Array.isArray(node.list) && node.list.length) {
                    return {
                        list: node.list,
                        total: Number((data.meta && data.meta.sum) || node.total || node.total_num || 0),
                    };
                }
            }
        }

        return { list: [], total: 0 };
    };

    // 鏂规1锛氬綋鍓嶄粛甯歌鐨� Desktop 鎼滅储璇锋眰銆備繚鐣� req_1銆乺emoteplace銆乻earchid銆�
    const desktopPayload = {
        comm: {
            ct: 24,
            cv: 0,
            uin: 0,
            format: "json",
            inCharset: "utf-8",
            outCharset: "utf-8",
            notice: 0,
            platform: "yqq.json",
            needNewCode: 1,
        },
        req_1: {
            method: "DoSearchForQQMusicDesktop",
            module: "music.search.SearchCgiService",
            param: {
                remoteplace: "txt.yqq.song",
                searchid: searchId,
                search_type: safeType,
                query: keyword,
                page_num: safePage,
                num_per_page: pageSize,
                highlight: 1,
                grp: 1,
            },
        },
    };

    let response = null;
    let parsed = { list: [], total: 0 };

    try {
        response = await request(desktopPayload);
        parsed = getList(response, "desktop");
    } catch (e) {
        parsed = { list: [], total: 0 };
    }

    // 鏂规2锛氬吋瀹瑰巻鍙� MusicFree/QQ 鎺ュ彛缁撴瀯銆�
    if (!parsed.list.length) {
        const legacyPayload = {
            comm: { ct: 24, cv: 0, uin: 0 },
            req_1: {
                method: "DoSearchForQQMusicDesktop",
                module: "music.search.SearchCgiService",
                param: {
                    remoteplace: "txt.yqq.song",
                    search_type: safeType,
                    query: keyword,
                    page_num: safePage,
                    num_per_page: pageSize,
                },
            },
        };

        try {
            response = await request(legacyPayload);
            parsed = getList(response, "legacy");
        } catch (e) {
            parsed = { list: [], total: 0 };
        }
    }

    // 鏂规3锛氬綋鍓嶇淮鎶ら」鐩粛鍦ㄤ娇鐢ㄧ殑 Mobile 鎼滅储鎺ュ彛銆�
    if (!parsed.list.length) {
        const mobilePayload = {
            comm: {
                ct: 24,
                cv: 0,
                uin: 0,
                format: "json",
            },
            req_1: {
                method: "DoSearchForQQMusicMobile",
                module: "music.search.SearchCgiService",
                param: {
                    searchid: searchId,
                    query: keyword,
                    search_type: safeType,
                    num_per_page: pageSize,
                    page_num: safePage,
                    highlight: 1,
                    grp: 1,
                },
            },
        };

        try {
            response = await request(mobilePayload);
            parsed = getList(response, "mobile");
        } catch (e) {
            parsed = { list: [], total: 0 };
        }
    }

    return {
        isEnd: parsed.total > 0
            ? parsed.total <= safePage * pageSize
            : parsed.list.length < pageSize,
        data: parsed.list,
    };
}

async function searchMusic(query, page) {
    const songs = await searchBase(query, page, 0);
    return {
        isEnd: songs.isEnd,
        // 鎼滅储缁撴灉涓嶅啀鎸� pay_play 杩囨护銆傝繖鏍� MusicFree 鑳界湅鍒� QQ 瀹樻柟鎼滅储杩斿洖鐨勫畬鏁寸粨鏋滐紝
        // 鍖呮嫭浼氬憳/鏀惰垂姝屾洸锛涙槸鍚﹀彲鐩存帴鎾斁鐢� QQ 鐨� Vkey 鎺ュ彛鏈€缁堝喅瀹氥€�
        data: songs.data.map(formatMusicItem),
    };
}
async function searchAlbum(query, page) {
    const albums = await searchBase(query, page, 2);
    return {
        isEnd: albums.isEnd,
        data: albums.data.map(formatAlbumItem),
    };
}
async function searchArtist(query, page) {
    const artists = await searchBase(query, page, 1);
    return {
        isEnd: artists.isEnd,
        data: artists.data.map(formatArtistItem),
    };
}
async function searchMusicSheet(query, page) {
    const musicSheet = await searchBase(query, page, 3);
    return {
        isEnd: musicSheet.isEnd,
        data: musicSheet.data.map((item) => ({
            title: item.dissname,
            createAt: item.createtime,
            description: item.introduction,
            playCount: item.listennum,
            worksNums: item.song_count,
            artwork: item.imgurl,
            id: item.dissid,
            artist: item.creator.name,
        })),
    };
}
async function searchLyric(query, page) {
    const songs = await searchBase(query, page, 7);
    return {
        isEnd: songs.isEnd,
        data: songs.data.map((it) => (Object.assign(Object.assign({}, formatMusicItem(it)), { rawLrcTxt: it.content }))),
    };
}
function getQueryFromUrl(key, search) {
    try {
        const sArr = search.split("?");
        let s = "";
        if (sArr.length > 1) {
            s = sArr[1];
        }
        else {
            return key ? undefined : {};
        }
        const querys = s.split("&");
        const result = {};
        querys.forEach((item) => {
            const temp = item.split("=");
            result[temp[0]] = decodeURIComponent(temp[1]);
        });
        return key ? result[key] : result;
    }
    catch (err) {
        return key ? "" : {};
    }
}
function changeUrlQuery(obj, baseUrl) {
    const query = getQueryFromUrl(null, baseUrl);
    let url = baseUrl.split("?")[0];
    const newQuery = Object.assign(Object.assign({}, query), obj);
    let queryArr = [];
    Object.keys(newQuery).forEach((key) => {
        if (newQuery[key] !== undefined && newQuery[key] !== "") {
            queryArr.push(`${key}=${encodeURIComponent(newQuery[key])}`);
        }
    });
    return `${url}?${queryArr.join("&")}`.replace(/\?$/, "");
}
const typeMap = {
    m4a: {
        s: "C400",
        e: ".m4a",
    },
    128: {
        s: "M500",
        e: ".mp3",
    },
    320: {
        s: "M800",
        e: ".mp3",
    },
    ape: {
        s: "A000",
        e: ".ape",
    },
    flac: {
        s: "F000",
        e: ".flac",
    },
};
async function getSourceUrl(songmid, mediaMid, type = "128") {
    const songId = String(songmid || "");
    const mediaId = String(mediaMid || songId);
    const guid = String(Math.floor(Math.random() * 9000000) + 1000000);
    const typeObj = typeMap[type] || typeMap["128"];

    // QQ 闊充箰鎾斁鏂囦欢浣跨敤 media_mid锛屼笉鏄� songmid銆�
    const file = `${typeObj.s}${mediaId}${typeObj.e}`;

    const data = {
        req_0: {
            module: "vkey.GetVkeyServer",
            method: "CgiGetVkey",
            param: {
                filename: [file],
                guid,
                songmid: [songId],
                songtype: [0],
                uin: "0",
                loginflag: 1,
                platform: "20",
            },
        },
        comm: {
            uin: 0,
            format: "json",
            ct: 24,
            cv: 0,
        },
    };

    return (await (0, axios_1.default)({
        url: "https://u.y.qq.com/cgi-bin/musicu.fcg",
        method: "POST",
        data,
        headers: Object.assign(Object.assign({}, headers), {
            "Content-Type": "application/json;charset=UTF-8",
            Accept: "application/json, text/plain, */*",
        }),
        timeout: 15000,
        xsrfCookieName: "XSRF-TOKEN",
        withCredentials: true,
    })).data;
}

async function getAlbumInfo(albumItem) {
    const url = changeUrlQuery({
        data: JSON.stringify({
            comm: {
                ct: 24,
                cv: 10000,
            },
            albumSonglist: {
                method: "GetAlbumSongList",
                param: {
                    albumMid: albumItem.albumMID,
                    albumID: 0,
                    begin: 0,
                    num: 999,
                    order: 2,
                },
                module: "music.musichallAlbum.AlbumSongList",
            },
        }),
    }, "https://u.y.qq.com/cgi-bin/musicu.fcg?g_tk=5381&format=json&inCharset=utf8&outCharset=utf-8");
    const res = (await (0, axios_1.default)({
        url: url,
        headers: headers,
        xsrfCookieName: "XSRF-TOKEN",
        withCredentials: true,
    })).data;
    return {
        musicList: res.albumSonglist.data.songList
            .filter((_) => validSongFilter(_.songInfo))
            .map((item) => {
            const _ = item.songInfo;
            return formatMusicItem(_);
        }),
    };
}
async function getArtistSongs(artistItem, page) {
    const url = changeUrlQuery({
        data: JSON.stringify({
            comm: {
                ct: 24,
                cv: 0,
            },
            singer: {
                method: "get_singer_detail_info",
                param: {
                    sort: 5,
                    singermid: artistItem.singerMID,
                    sin: (page - 1) * pageSize,
                    num: pageSize,
                },
                module: "music.web_singer_info_svr",
            },
        }),
    }, "http://u.y.qq.com/cgi-bin/musicu.fcg");
    const res = (await (0, axios_1.default)({
        url: url,
        method: "get",
        headers: headers,
        xsrfCookieName: "XSRF-TOKEN",
        withCredentials: true,
    })).data;
    return {
        isEnd: res.singer.data.total_song <= page * pageSize,
        data: res.singer.data.songlist.filter(validSongFilter).map(formatMusicItem),
    };
}
async function getArtistAlbums(artistItem, page) {
    const url = changeUrlQuery({
        data: JSON.stringify({
            comm: {
                ct: 24,
                cv: 0,
            },
            singerAlbum: {
                method: "get_singer_album",
                param: {
                    singermid: artistItem.singerMID,
                    order: "time",
                    begin: (page - 1) * pageSize,
                    num: pageSize / 1,
                    exstatus: 1,
                },
                module: "music.web_singer_info_svr",
            },
        }),
    }, "http://u.y.qq.com/cgi-bin/musicu.fcg");
    const res = (await (0, axios_1.default)({
        url,
        method: "get",
        headers: headers,
        xsrfCookieName: "XSRF-TOKEN",
        withCredentials: true,
    })).data;
    return {
        isEnd: res.singerAlbum.data.total <= page * pageSize,
        data: res.singerAlbum.data.list.map(formatAlbumItem),
    };
}
async function getArtistWorks(artistItem, page, type) {
    if (type === "music") {
        return getArtistSongs(artistItem, page);
    }
    if (type === "album") {
        return getArtistAlbums(artistItem, page);
    }
}
async function getLyric(musicItem) {
    const result = (await (0, axios_1.default)({
        url: `http://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${musicItem.songmid}&pcachetime=${new Date().getTime()}&g_tk=5381&loginUin=0&hostUin=0&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0`,
        headers: { Referer: "https://y.qq.com", Cookie: "uin=" },
        method: "get",
        xsrfCookieName: "XSRF-TOKEN",
        withCredentials: true,
    })).data;
    const res = JSON.parse(result.replace(/callback\(|MusicJsonCallback\(|jsonCallback\(|\)$/g, ""));
    let translation;
    if (res.trans) {
        translation = he.decode(CryptoJs.enc.Base64.parse(res.trans).toString(CryptoJs.enc.Utf8));
    }
    return {
        rawLrc: he.decode(CryptoJs.enc.Base64.parse(res.lyric).toString(CryptoJs.enc.Utf8)),
        translation,
    };
}
async function importMusicSheet(urlLike) {
    let id;
    if (!id) {
        id = (urlLike.match(/https?:\/\/i\.y\.qq\.com\/n2\/m\/share\/details\/taoge\.html\?.*id=([0-9]+)/) || [])[1];
    }
    if (!id) {
        id = (urlLike.match(/https?:\/\/y\.qq\.com\/n\/ryqq\/playlist\/([0-9]+)/) ||
            [])[1];
    }
    if (!id) {
        id = (urlLike.match(/^(\d+)$/) || [])[1];
    }
    if (!id) {
        return;
    }
    const result = (await (0, axios_1.default)({
        url: `http://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&utf8=1&disstid=${id}&loginUin=0`,
        headers: { Referer: "https://y.qq.com/n/yqq/playlist", Cookie: "uin=" },
        method: "get",
        xsrfCookieName: "XSRF-TOKEN",
        withCredentials: true,
    })).data;
    const res = JSON.parse(result.replace(/callback\(|MusicJsonCallback\(|jsonCallback\(|\)$/g, ""));
    return res.cdlist[0].songlist.filter(validSongFilter).map(formatMusicItem);
}
async function getTopLists() {
    const list = await (0, axios_1.default)({
        url: "https://u.y.qq.com/cgi-bin/musicu.fcg?_=1577086820633&data=%7B%22comm%22%3A%7B%22g_tk%22%3A5381%2C%22uin%22%3A123456%2C%22format%22%3A%22json%22%2C%22inCharset%22%3A%22utf-8%22%2C%22outCharset%22%3A%22utf-8%22%2C%22notice%22%3A0%2C%22platform%22%3A%22h5%22%2C%22needNewCode%22%3A1%2C%22ct%22%3A23%2C%22cv%22%3A0%7D%2C%22topList%22%3A%7B%22module%22%3A%22musicToplist.ToplistInfoServer%22%2C%22method%22%3A%22GetAll%22%2C%22param%22%3A%7B%7D%7D%7D",
        method: "get",
        headers: {
            Cookie: "uin=",
        },
        xsrfCookieName: "XSRF-TOKEN",
        withCredentials: true,
    });
    return list.data.topList.data.group.map((e) => ({
        title: e.groupName,
        data: e.toplist.map((_) => ({
            id: _.topId,
            description: _.intro,
            title: _.title,
            period: _.period,
            coverImg: _.headPicUrl || _.frontPicUrl,
        })),
    }));
}
async function getTopListDetail(topListItem) {
    var _a;
    const res = await (0, axios_1.default)({
        url: `https://u.y.qq.com/cgi-bin/musicu.fcg?g_tk=5381&data=%7B%22detail%22%3A%7B%22module%22%3A%22musicToplist.ToplistInfoServer%22%2C%22method%22%3A%22GetDetail%22%2C%22param%22%3A%7B%22topId%22%3A${topListItem.id}%2C%22offset%22%3A0%2C%22num%22%3A100%2C%22period%22%3A%22${(_a = topListItem.period) !== null && _a !== void 0 ? _a : ""}%22%7D%7D%2C%22comm%22%3A%7B%22ct%22%3A24%2C%22cv%22%3A0%7D%7D`,
        method: "get",
        headers: {
            Cookie: "uin=",
        },
        xsrfCookieName: "XSRF-TOKEN",
        withCredentials: true,
    });
    return Object.assign(Object.assign({}, topListItem), { musicList: res.data.detail.data.songInfoList
            .filter(validSongFilter)
            .map(formatMusicItem) });
}
async function getRecommendSheetTags() {
    const res = (await axios_1.default.get("https://c.y.qq.com/splcloud/fcgi-bin/fcg_get_diss_tag_conf.fcg?format=json&inCharset=utf8&outCharset=utf-8", {
        headers: {
            referer: "https://y.qq.com/",
        },
    })).data.data.categories;
    const data = res.slice(1).map((_) => ({
        title: _.categoryGroupName,
        data: _.items.map((tag) => ({
            id: tag.categoryId,
            title: tag.categoryName,
        })),
    }));
    const pinned = [];
    for (let d of data) {
        if (d.data.length) {
            pinned.push(d.data[0]);
        }
    }
    return {
        pinned,
        data,
    };
}
async function getRecommendSheetsByTag(tag, page) {
    const pageSize = 20;
    const rawRes = (await axios_1.default.get("https://c.y.qq.com/splcloud/fcgi-bin/fcg_get_diss_by_tag.fcg", {
        headers: {
            referer: "https://y.qq.com/",
        },
        params: {
            inCharset: "utf8",
            outCharset: "utf-8",
            sortId: 5,
            categoryId: (tag === null || tag === void 0 ? void 0 : tag.id) || "10000000",
            sin: pageSize * (page - 1),
            ein: page * pageSize - 1,
        },
    })).data;
    const res = JSON.parse(rawRes.replace(/callback\(|MusicJsonCallback\(|jsonCallback\(|\)$/g, "")).data;
    const isEnd = res.sum <= page * pageSize;
    const data = res.list.map((item) => {
        var _a, _b;
        return ({
            id: item.dissid,
            createTime: item.createTime,
            title: item.dissname,
            artwork: item.imgurl,
            description: item.introduction,
            playCount: item.listennum,
            artist: (_b = (_a = item.creator) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : "",
        });
    });
    return {
        isEnd,
        data,
    };
}
async function getMusicSheetInfo(sheet, page) {
    const data = await importMusicSheet(sheet.id);
    return {
        isEnd: true,
        musicList: data,
    };
}
module.exports = {
    platform: "QQ闊充箰",
    author: "鐚ご鐚�",
    version: "0.2.2-alpha.3",
    srcUrl: "https://gitee.com/maotoumao/MusicFreePlugins/raw/v0.1/dist/qq/index.js",
    cacheControl: "no-cache",
    hints: {
        importMusicSheet: [
            "QQ闊充箰APP锛氳嚜寤烘瓕鍗�-鍒嗕韩-鍒嗕韩鍒板井淇″ソ鍙�/QQ濂藉弸锛涚劧鍚庣偣寮€骞跺鍒堕摼鎺ワ紝鐩存帴绮樿创鍗冲彲",
            "H5锛氬鍒禪RL骞剁矘璐达紝鎴栬€呯洿鎺ヨ緭鍏ョ函鏁板瓧姝屽崟ID鍗冲彲",
            "瀵煎叆杩囩▼涓細杩囨护鎺夋墍鏈塚IP/璇曞惉/鏀惰垂闊充箰锛屽鍏ユ椂闂村拰姝屽崟澶у皬鏈夊叧锛岃鑰愬績绛夊緟",
        ],
    },
    primaryKey: ["id", "songmid"],
    supportedSearchType: ["music", "album", "sheet", "artist", "lyric"],
    async search(query, page, type) {
        if (type === "music") {
            return await searchMusic(query, page);
        }
        if (type === "album") {
            return await searchAlbum(query, page);
        }
        if (type === "artist") {
            return await searchArtist(query, page);
        }
        if (type === "sheet") {
            return await searchMusicSheet(query, page);
        }
        if (type === "lyric") {
            return await searchLyric(query, page);
        }
    },
    async getMediaSource(musicItem, quality) {
        let purl = "";
        let domain = "";
        let type = "128";
        if (quality === "standard") {
            type = "320";
        }
        else if (quality === "high") {
            type = "m4a";
        }
        else if (quality === "super") {
            type = "flac";
        }

        let result = await getSourceUrl(
            musicItem.songmid,
            musicItem.media_mid,
            type
        );

        // QQ 闊充箰鎺ュ彛瀹為檯鍙兘杩斿洖 req_0銆乺eq_1 鎴� req銆�
        // 淇濈暀宸茬粡楠岃瘉鍙挱鏀剧殑璺緞锛涜秴楂橀煶璐ㄥ鏋� F000 娌℃湁鍦板潃锛�
        // 鍐嶅皾璇� A000锛岄伩鍏嶇洿鎺ユ帀鍒板叾瀹冮煶婧愩€�
        let reqBlock =
            result &&
            (result.req_0 || result.req_1 || result.req);

        let sourceData =
            (reqBlock && reqBlock.data) || {};

        if (quality === "super" && !(sourceData.midurlinfo && sourceData.midurlinfo[0] && (sourceData.midurlinfo[0].purl || sourceData.midurlinfo[0].wifiurl))) {
            result = await getSourceUrl(
                musicItem.songmid,
                musicItem.media_mid,
                "ape"
            );
            reqBlock = result && (result.req_0 || result.req_1 || result.req);
            sourceData = (reqBlock && reqBlock.data) || {};
        }

        const midurlinfo =
            Array.isArray(sourceData.midurlinfo)
                ? sourceData.midurlinfo
                : [];

        const firstUrl = midurlinfo[0] || {};

        purl =
            firstUrl.purl ||
            firstUrl.wifiurl ||
            "";

        if (!purl) {
            return null;
        }

        if (domain === "") {
            const sip =
                Array.isArray(sourceData.sip)
                    ? sourceData.sip
                    : [];

            domain =
                sip.find(
                    (i) =>
                        typeof i === "string" &&
                        !i.startsWith("http://ws")
                ) ||
                sip[0] ||
                "";
        }

        if (/^https?:\/\//.test(purl)) {
            return {
                url: purl,
                quality,
                headers: {
                    Referer: "https://y.qq.com/",
                },
            };
        }

        if (!domain) {
            return null;
        }

        return {
            url: `${domain}${purl}`,
            quality,
            headers: {
                Referer: "https://y.qq.com/",
            },
        };
    },
    getLyric,
    getAlbumInfo,
    getArtistWorks,
    importMusicSheet,
    getTopLists,
    getTopListDetail,
    getRecommendSheetTags,
    getRecommendSheetsByTag,
    getMusicSheetInfo,
};
