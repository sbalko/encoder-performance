const encoder = new VideoEncoder({
    output: chunk => {
        console.log('Next chunk', chunk);
    },
    error: error => {
        console.error('Encoder produced error', error);
    },
});

const aggregate = {
    all: [],
    min: Number.MAX_VALUE,
    max: 0,
    avg: 0,
    sum: 0,
};

function update(duration) {
    aggregate.all.push(duration);
    aggregate.min = Math.min(aggregate.min, duration);
    aggregate.max = Math.max(aggregate.max, duration);
    aggregate.sum += duration;
}
  
async function encode(frames) {
    for (const frame of frames) {
        while (encoder.encodeQueueSize > 5) {
            console.warn(`Encode queue spilling over (${encoder.encodeQueueSize} frames), waiting...`);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log('Now encoding frame', frame);
        const before = performance.now();
        encoder.encode(frame);
        const after = performance.now();

        frame.close();

        update(after-before);
    }

    aggregate.all.sort();
    const len = aggregate.all.length;
    const half = len >> 1;
    const median = len % 2 === 1 ? aggregate.all[len >> 1] : (aggregate.all[half - 1] + aggregate.all[half]) / 2;

    return {
        count: len,
        min: aggregate.min,
        max: aggregate.max,
        avg: aggregate.sum / len,
        median,
    };
}

function done(response) {
    self.postMessage({
        kind: 'done',
        response
    });
}

self.onmessage = async event => {
    switch(event.data.kind) {
        case 'config':
            encoder.configure(event.data.configuration);
            console.log('Encoder configured', event.data.configuration);
            done();
            break;
        case 'close':
            encoder.close();
            console.log('Encoder closed');
            done();
            break;
        case 'encode':
            const stats = await encode(event.data.frames);
            done(stats);
            break;
    }
};