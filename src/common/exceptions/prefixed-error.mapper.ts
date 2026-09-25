import {
    ConflictException,
    HttpException,
    InternalServerErrorException,
    NotFoundException,
    UnauthorizedException,
    UnprocessableEntityException,
} from '@nestjs/common';

export function mapPrefixedErrorToHttpException(message: string): HttpException {
    const [code, ...details] = message.split(':');
    const errorCode = code.trim();
    const errorMessage = details.join(':').trim() || message;

    switch (errorCode) {
        case 'NO_EMAIL_FOUND':
            return new NotFoundException(errorMessage);
        case 'GMAIL_SESSION_EXPIRED':
            return new UnauthorizedException(errorMessage);
        case 'NO_OTP_FOUND':
        case 'EMAIL_BODY_EMPTY':
        case 'NO_CLICKABLE_EMAIL':
            return new UnprocessableEntityException(errorMessage);
        case 'DUPLICATE_EMAIL':
            return new ConflictException(errorMessage);
        default:
            return new InternalServerErrorException(errorMessage);
    }
}