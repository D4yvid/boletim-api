import { VercelRequestQuery } from "@vercel/node";
import { BoletimFetchRequest } from "../../../boletim/boletim";
import { Err, Ok, Result } from "../../../util/error";

import {
    ERROR_BIRTH_DATE_NOT_PROVIDED,
    ERROR_BIRTH_DATE_NOT_VALID,
    ERROR_MOTHER_NAME_NOT_PROVIDED,
    ERROR_STUDENT_NAME_NOT_PROVIDED,
    ERROR_YEAR_NOT_IN_RANGE,
    ERROR_YEAR_NOT_PROVIDED,
    ERROR_YEAR_NOT_VALID,
} from "../../../boletim/error";

export function validateRequestParameters(
    query: VercelRequestQuery,
): Result<BoletimFetchRequest, { code: number; message: string }> {
    if (!query.studentName) {
        return Err({
            code: ERROR_STUDENT_NAME_NOT_PROVIDED,
            message: "The 'studentName' field was not supplied",
        });
    }

    const studentName: string = query.studentName as string;

    if (!query.motherName) {
        return Err({
            code: ERROR_MOTHER_NAME_NOT_PROVIDED,
            message: "The 'motherName' field was not supplied",
        });
    }

    const motherName: string = query.motherName as string;

    if (!query.year) {
        return Err({
            code: ERROR_YEAR_NOT_PROVIDED,
            message: "The 'year' field was not supplied",
        });
    }

    const yearString: string = query.year as string;

    if (!yearString.match(/[0-9]{4}/g)) {
        return Err({
            code: ERROR_YEAR_NOT_VALID,
            message: "The 'year' field doesn't matches the format YYYY",
        });
    }

    const year = parseInt(yearString);

    if (year < 2020 || year > 2024) {
        return Err({
            code: ERROR_YEAR_NOT_IN_RANGE,
            message: "The 'year' field is not in the range 2020 <= n <= 2024",
        });
    }

    if (!query.birthDate) {
        return Err({
            code: ERROR_BIRTH_DATE_NOT_PROVIDED,
            message: "The 'birthDate' field was not supplied",
        });
    }

    const birthDate: string = query.birthDate as string;

    if (!birthDate.match(/[0-9]{2}\/[0-9]{2}\/[0-9]{4}/g)) {
        return Err({
            code: ERROR_BIRTH_DATE_NOT_VALID,
            message:
                "The 'birthDate' field doesn't matches the format dd/mm/YYYY",
        });
    }

    return Ok({
        birthDate,
        motherName,
        studentName,
        year,
    });
}
