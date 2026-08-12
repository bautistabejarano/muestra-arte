module.exports = function (eleventyConfig) {
  // Copiamos tal cual la carpeta de estilos y las fotos ya optimizadas
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy({ "src/img": "img" });

  return {
    pathPrefix: "/muestra-arte/",
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
  };
};
