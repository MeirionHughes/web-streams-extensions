export function interval<T>(duration): ReadableStream<T> {
    let count = 0;
    let timer = null;

    return new ReadableStream<T>({
        async start(controller) {
            timer = setInterval(() => {
                controller.enqueue()
            }, duration);
        },
        async cancel() {
            if (timer) {
                clearInterval
            }
        }
    });
}