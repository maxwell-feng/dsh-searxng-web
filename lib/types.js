/** Build a classified ProviderError (code mirrors the dsh-web seam codes). */
export function providerError(code, message, status) {
    const err = new Error(message);
    err.code = code;
    if (status !== undefined)
        err.status = status;
    return err;
}
