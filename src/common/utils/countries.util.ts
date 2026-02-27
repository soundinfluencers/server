export const areCountriesValid = (countries: object[]): boolean => {
  let areCountriesValid = false;

  if (countries.length === 0) {
      areCountriesValid = true;
  }
  if (countries.length !== 0 && countries.length === 5) {
      areCountriesValid = true;
  }

  return areCountriesValid;
};