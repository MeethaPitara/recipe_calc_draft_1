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
    // Check if debug mode is enabled
    // const isDebugMode = import.meta.env.NEXT_PUBLIC_DEBUG_MODE === 'true' || import.meta.env.VITE_DEBUG_MODE === 'true';

    // if (!isDebugMode) return;


    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Format based on payload type
    let snapshot = '';
    try {
        if (typeof payload === 'object') {
            // Deep clone to avoid logging reference mutations later
            snapshot = JSON.stringify(payload, null, 2);
        } else {
            snapshot = String(payload);
        }
    } catch (e) {
        snapshot = '[Circular or Non-Serializable Data]';
    }

    const logMessage = `[${timestamp}] [${file}:${functionName}] [${action}]`;

    console.groupCollapsed(`🛑 TRACE: ${file} :: ${functionName} -> ${action}`);
    console.log(logMessage);
    console.log('Data Snapshot:', typeof payload === 'object' ? JSON.parse(JSON.stringify(payload)) : payload);
    console.groupEnd();
};
