import {
    ArgumentMetadata,
    BadRequestException,
    Injectable,
    PipeTransform,
    Type,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

type ClassConstructor<T = unknown> = Type<T>;

export type OneOfDtoVariant = {
    dto: ClassConstructor;
    match?: (value: any) => boolean;
};

// Custom pipe for validation data that can be ONE OF several DTOs
@Injectable()
export class OneOfQueryPipe implements PipeTransform {
    constructor(private readonly variants: OneOfDtoVariant[]) {}

    async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
        const matchedVariants = this.variants.filter((variant) =>
            variant.match ? variant.match(value) : true,
        );

        const variantsToCheck = matchedVariants.length > 0 ? matchedVariants : this.variants;

        const collectedErrors: { dto: string; errors: ValidationError[] }[] = [];

        for (const variant of variantsToCheck) {
            const dtoObject = plainToInstance(variant.dto, value);

            const errors = await validate(dtoObject as object, {
                whitelist: true,
                forbidNonWhitelisted: true,
            });

            if (errors.length === 0) {
                return dtoObject;
            }

            collectedErrors.push({
                dto: variant.dto.name,
                errors,
            });
        }

        throw new BadRequestException({
            message: 'Validation failed for all supported query DTOs',
            variants: collectedErrors.map((item) => ({
                dto: item.dto,
                errors: this.mapErrors(item.errors),
            })),
        });
    }

    private mapErrors(errors: ValidationError[]) {
        return errors.map((error) => ({
            property: error.property,
            constraints: error.constraints ?? {},
            children: error.children?.length ? this.mapErrors(error.children) : [],
        }));
    }
}