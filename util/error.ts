export type Ok<T> = {
    success: true;
    value: T;
};

export type Err<T> = {
    success: false;
    value: T;
};

export type Result<V, E> = Ok<V> | Err<E>;

export function Ok<T>(value: T): Ok<T> {
    return { success: true, value };
}

export function Err<T>(value: T): Err<T> {
    return { success: false, value };
}

export function unwrap<T>(opt: Result<T, any>): T {
    if (!opt.success) {
        throw opt.value;
    }

    return opt.value;
}
