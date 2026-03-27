import {
    registerDecorator,
    ValidationArguments,
    ValidationOptions,
} from 'class-validator';

type EnumLike = Record<string, string>;

export function ExactlyOneDefined<T extends object>(
    allowedFields: readonly (keyof T)[] | EnumLike,
    validationOptions?: ValidationOptions,
) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            name: 'exactlyOneDefined',
            target: object.constructor,
            propertyName,
            constraints: [allowedFields],
            options: validationOptions,
            validator: {
                validate(_: unknown, args: ValidationArguments) {
                    const dto = args.object as Record<string, unknown>;
                    const [rawFields] = args.constraints as [readonly (keyof T)[] | EnumLike];

                    const fields = Array.isArray(rawFields)
                        ? rawFields
                        : (Object.values(rawFields) as (keyof T)[]);

                    const definedFields = fields.filter(
                        (field) => dto[field as string] !== undefined,
                    );

                    return definedFields.length === 1;
                },

                defaultMessage(args: ValidationArguments) {
                    const [rawFields] = args.constraints as [readonly (keyof T)[] | EnumLike];

                    const fields = Array.isArray(rawFields)
                        ? rawFields
                        : Object.values(rawFields);

                    return `Exactly one of these fields must be provided: ${fields.join(', ')}`;
                },
            },
        });
    };
}