import { VercelRequest, VercelResponse } from "@vercel/node";
import { cache } from "../../../util/cache";
import { useResponse } from "../../../util/response";
import { BAD_REQUEST, INTERNAL_SERVER_ERROR, GET, OK } from "../../../util/status";
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

  const res = useResponse(response);

  if (request.method != GET) {
    return res("invalid request method", BAD_REQUEST);
  }

  try {
    const query = request.query as { [key: string]: string };

    const fetchRequest = unwrap(validateRequestParameters(query));
    const boletim = unwrap(await fetchBoletim(fetchRequest));

    return res(boletim, OK);
  } catch (err: unknown) {
    return res(err, INTERNAL_SERVER_ERROR);
  }
}
