import { VercelRequest, VercelResponse } from "@vercel/node";
import { cache } from "../../../util/cache";
import { useResponse } from "../../../util/response";
import { BAD_REQUEST, INTERNAL_SERVER_ERROR, OK } from "../../../util/status";
import {
  fetchBoletim,
  validateRequestParameters,
} from "../../../boletim/boletim";
import { unwrap } from "../../../util/error";

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  cache(response);

  const result = useResponse(response);

  if (request.method != "GET") {
    return result(null, BAD_REQUEST);
  }

  try {
    const query = request.query as { [key: string]: string };

    const fetchRequest = unwrap(validateRequestParameters(query));
    const boletim = unwrap(await fetchBoletim(fetchRequest));

    return result(boletim, OK);
  } catch (err: unknown) {
    return result(err, INTERNAL_SERVER_ERROR);
  }
}
