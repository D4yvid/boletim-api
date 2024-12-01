import { VercelResponse } from "@vercel/node";

export function useResponse(response: VercelResponse) {
    return (data: any = {}, status: number = 200) => {
        return response.status(status).json({
            status,
            data,
        });
    };
}
