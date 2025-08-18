import { VercelResponse } from "@vercel/node";
import { OK } from "./status";

export function useResponse(response: VercelResponse) {
  return (data: any = {}, status: number = 200) => {
    const error = status !== OK;

    return response.status(status).json({
      error,
      data
    });
  };
}
