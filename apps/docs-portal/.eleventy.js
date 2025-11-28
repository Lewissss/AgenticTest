export default function (eleventyConfig) {
    eleventyConfig.addPassthroughCopy({ "public": "assets" });

    return {
        dir: {
            input: "content",
            includes: "../_includes",
            data: "../_data",
            output: "dist"
        },
        markdownTemplateEngine: "njk",
        htmlTemplateEngine: "njk"
    };
}
