
export interface ReadableLike<T = any> {
    readonly readable: ReadableStream<T>;
}

export function isReadableLike<T>(obj: object): obj is ReadableLike {
    return obj['readable'] != null;
}
