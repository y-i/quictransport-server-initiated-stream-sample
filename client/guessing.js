// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Adds an entry to the event log on the page, optionally applying a specified
// CSS class.
function addToEventLog(text, severity = 'info') {
  let log = document.getElementById('event-log');
  let mostRecentEntry = log.lastElementChild;
  let entry = document.createElement('li');
  entry.innerText = text;
  entry.className = 'log-' + severity;
  log.appendChild(entry);

  // If the most recent entry in the log was visible, scroll the log to the
  // newly added element.
  if (mostRecentEntry != null &&
    mostRecentEntry.getBoundingClientRect().top <
    log.getBoundingClientRect().bottom) {
    entry.scrollIntoView();
  }
}

// "Connect" button handler.
async function connect() {
  let url = document.getElementById('url').value;
  try {
    var transport = new QuicTransport(url);
    console.log(transport);
    addToEventLog('Initiating connection...');
  } catch (err) {
    addToEventLog('Failed to create connection object. ' + err, 'error');
    return;
  }

  try {
    await transport.ready;
    addToEventLog('Connection ready.');
  } catch (err) {
    addToEventLog('Connection failed. ' + err, 'error');
    return;
  }

  transport.closed
    .then(() => {
      addToEventLog('Connection closed normally.');
      console.log('Connection closed normally.');
    })
    .catch((e) => {
      addToEventLog('Connection closed abruptly.', 'error');
      console.log('Connection closed abruptly.', 'error', e);
    });
  globalThis.streamNumber = 1;

  readBidirectionalStreams(transport);

  document.getElementById('connect').disabled = true;
  document.getElementById('send').disabled = false;
}

let stream;
async function readBidirectionalStreams(transport) {
  const reader = transport.receiveBidirectionalStreams().getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      console.log('readBidirectionalStreams', value);
      if (done) {
        addToEventLog('Done accepting bidirectional streams!');
        break;
      }
      stream = value;
      const number = globalThis.streamNumber++;
      addToEventLog('New incoming bidirectional stream #' + number);
      readFromIncomingStream(stream, number);
    }
  } catch (err) {
    addToEventLog('Error while accepting streams: ' + err, 'error');
  }
}

async function sendNumber() {
  if (stream === undefined) {
    addToEventLog('Stream is not opened.');
    return;
  }

  const encoder = new TextEncoder('utf-8');
  const rawData = document.getElementById('number').value;
  const data = encoder.encode(rawData);
  try {
    if (data === 'fin') {
      writer.close();
      return;
    }

    const number = globalThis.streamNumber++;

    const writer = stream.writable.getWriter();
    await writer.write(data);
    writer.releaseLock();
  } catch (err) {
    addToEventLog('Error while sending data: ' + err, 'error');
  }
}

async function readFromIncomingStream(stream, number) {
  let decoder = new TextDecoderStream('utf-8');
  let reader = stream.readable.pipeThrough(decoder).getReader();
  try {
    while (true) {
      let result = await reader.read();

      let data = result.value;
      addToEventLog('Received data on stream #' + number + ': ' + data);

      console.log('Received data on stream #' + number + ': ' + data);

      if (result.done) {
        addToEventLog('Stream #' + number + ' closed');
        return;
      }
    }
  } catch (err) {
    addToEventLog(
      'Error while reading from stream #' + number + ': ' + err, 'error');
  }
}
