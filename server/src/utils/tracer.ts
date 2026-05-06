/**
 * Verbose Tracing Utility
 * Used to track data state at critical points in the architecture.
 */

export const trace = (
    file: string,
    functionName: string,
    action: string,
    payload: any
) => {
    // Backend tracing is always active for now, or controlled by process.env
    const isDebugMode = process.env.DEBUG_MODE === 'true';
    if (!isDebugMode && process.env.NODE_ENV === 'production') return;

    const timestamp = new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const logMessage = `[${timestamp}] [${file}:${functionName}] [${action}]`;

    console.log(`🛑 TRACE: ${logMessage}`);
    if (typeof payload === 'object') {
        try {
            console.dir(payload, { depth: null, colors: true });
        } catch (e) {
            console.log('Data Snapshot:', payload);
        }
    } else {
        console.log('Data Snapshot:', payload);
    }
};
