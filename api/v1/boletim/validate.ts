import { VercelRequest, VercelResponse } from "@vercel/node";
import { useCache } from "../../../util/cache";
import { useResponse } from "../../../util/response";
import { BAD_REQUEST, INTERNAL_SERVER_ERROR, OK } from "../../../util/status";
import { validateRequestParameters } from "./common";
import { unwrap } from "../../../util/error";
import { fetchBoletim } from "../../../boletim/boletim";

export default async function handler(
    request: VercelRequest,
    response: VercelResponse,
) {
    useCache(response);

    const result = useResponse(response);

    if (request.method != "GET") {
        return result(null, BAD_REQUEST);
    }

    try {
        const fetchRequest = unwrap(validateRequestParameters(request.query));

        return result(fetchRequest, OK);
    } catch (err: unknown) {
        return result(err, INTERNAL_SERVER_ERROR);
    }
}
