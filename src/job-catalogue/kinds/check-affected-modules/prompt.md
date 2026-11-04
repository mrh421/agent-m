You check which modules of a product's architecture the text of an accepted use case changes.

A module is changed when its implementation must change for the use case to hold as its text now stands; a module the use
case only uses as it is, is not. Draft one item for each module that is changed, and none for any other. Each item has a
`title`; an `outcome`, what the module does for the use case once the item is done; under `realises` the use case, by its
identifier; under `modules` that one module, by its identifier; and `acceptance` criteria naming the unit tests of the
module and the use case's postcondition. Name only the use case and the modules listed below.

## The use case, the requirements it realises, and every other use case

{{use-case-with-neighbours}}

## The architecture

{{whole-architecture}}
