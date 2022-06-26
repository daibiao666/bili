  function encodeUtf8(str) {
  let bytes = [];
  let len, c;
  len = str.length;
  for (let i = 0; i < len; i++) {
  c = str.charCodeAt(i);
  if (c >= 0x010000 && c <= 0x10FFFF) {
  bytes.push(((c >> 18) & 0x07) | 0xF0);
  bytes.push(((c >> 12) & 0x3F) | 0x80);
  bytes.push(((c >> 6) & 0x3F) | 0x80);
  bytes.push((c & 0x3F) | 0x80);
} else if (c >= 0x000800 && c <= 0x00FFFF) {
  bytes.push(((c >> 12) & 0x0F) | 0xE0);
  bytes.push(((c >> 6) & 0x3F) | 0x80);
  bytes.push((c & 0x3F) | 0x80);
} else if (c >= 0x000080 && c <= 0x0007FF) {
  bytes.push(((c >> 6) & 0x1F) | 0xC0);
  bytes.push((c & 0x3F) | 0x80);
} else {
  bytes.push(c & 0xFF);
}
}
  return bytes;
}

  function byteToString(arr) {
  if (typeof arr === 'string') {
  return arr;
}
  let str = '',
  _arr = arr;
  for (let i = 0; i < _arr.length; i++) {
  let one = _arr[i].toString(2),
  v = one.match(/^1+?(?=0)/);
  if (v && one.length == 8) {
  let bytesLength = v[0].length;
  let store = _arr[i].toString(2).slice(7 - bytesLength);
  for (let st = 1; st < bytesLength; st++) {
  store += _arr[st + i].toString(2).slice(2);
}
  str += String.fromCharCode(parseInt(store, 2));
  i += bytesLength - 1;
} else {
  str += String.fromCharCode(_arr[i]);
}
}
  return str;
}

  // 创建WebSocket
  const ws = new WebSocket("wss://broadcastlv.chat.bilibili.com:2245/sub");
  let connecting = false;
  ws.onopen = e => {
  console.log("open");
  connecting = true;

  // 发送初始信息
  let data = {
  "uid": 0,
  "roomid": 12722541,
  "protover": 1,
  "platform": "web",
  "clientver": "1.4.0"
};
  let body = encodeUtf8(JSON.stringify(data));
  let bodyLen = body.length;
  let headLen = 16;

  let header = [0, 0, 0, headLen + bodyLen, 0, headLen, 0, 1, 0, 0, 0, 7, 0, 0, 0, 1];

  let sendTxt = header.concat(body);

  ws.send(byteToString(sendTxt));

  // 循环发送心跳包
  let heart = [0, 0, 0, 18, 0, headLen, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 123, 125];
  let startHeart = setInterval(() => {
  if (connecting) {
  ws.send(byteToString(heart));
} else {
  clearInterval(startHeart);
}
}, 30000);
};
  ws.onclose = e => {
    connecting = false;
  };
  ws.onmessage = e => {
    // 输出收到的数据
    let data = e.data;
    let cntt = 0;
    let offset = 0;
    while (offset < data.byteLength) {
      let total = 0;
      let totalLen = new Uint8Array(data.slice(offset, offset + 4));
      for (let [i, num] of totalLen.entries()) {
        total += num * Math.pow(16, (3 - i) * 2);
      }

      let header = 0;
      let headerLen = new Uint8Array(data.slice(offset + 4, offset + 6));
      for (let [i, num] of headerLen.entries()) {
        header += num * Math.pow(16, (1 - i) * 2);
      }

      let type = 0;
      let typeLen = new Uint8Array(data.slice(offset + 10, offset + 12));
      for (let [i, num] of typeLen.entries()) {
        type += num * Math.pow(16, (1 - i) * 2);
      }

      let msg = null;
      switch (type) {
        case 3: {
          // 人气
          let temp = 0;
          let popuLen = new Uint8Array(data.slice(offset + 16, offset + total));
          for (let [i, num] of popuLen.entries()) {
            temp += num * Math.pow(16, (3 - i) * 2);
          }
          break;
        }
        case 5: {
          // 弹幕
          let msgLen = new Uint8Array(data.slice(offset + 16, offset + total));
          let decode = false;
          let jso;
          try {
            msgLen = pako.inflate(msgLen);
            decode = true;
          } catch (e) {
            decode = false;
          }

          if (decode) {
            let i = 0;
            let segLen = 0;
            while (i < msgLen.length) {
              segLen = msgLen[i + 2] * 256 + msgLen[i + 3];
              jso = JSON.parse(byteToString(msgLen.slice(i + 16, i + segLen)));

              i = i + segLen;
            }
          } else {
            jso = JSON.parse(byteToString(msgLen));
          }

          if (jso["cmd"] == "DANMU_MSG") {
            console.log(jso["info"][1]);
          }

          break;
        }
      }

      offset += total;
      ++cntt;
    }
  };
  ws.binaryType = "arraybuffer";
