import { Platform, setIcon } from 'obsidian'
import { Env } from 'src/api'

function GetTooltip( name: string )
{
    if ( name.includes( ':' ) )
    {
        return name.split( ':' )[ 1 ].trim( )
    }
    else
    {
        return name
    }
}

/*
    Get Icon Size
*/

export function GetIconSize( )
{
    const iconSize = Platform.isDesktop ? 18 : 24
    return iconSize
}

/*
    Remove Elements
*/

export function RemoveElements( element: HTMLCollectionOf< Element > ): void
{
    for ( let i = element.length; i >= 0; i-- )
    {
        if ( element[ i ] )
        {
            element[ i ].remove( )
        }
    }
}

/*
    Remove all viewaction buttons
*/

export function RemoveLeafButtonsAll( )
{
    const activeLeaves: HTMLElement[] = []

    this.app.workspace.iterateAllLeaves( ( leaf: { view: { containerEl: HTMLElement } } ) =>
    {
        activeLeaves.push( leaf.view.containerEl )
    } )

    for ( const leaf of activeLeaves )
    {
        const element = leaf.getElementsByClassName( Env.pluginId )

        if ( element.length > 0 )
        {
            RemoveElements( element )
        }
    }
}

/*
    Get Button Icon
*/

export function GetButtonIcon( name: string, id: string, icon: string, iconSize: number, classNames: string[], tag: 'a' | 'div' = 'a' )
{
    const tooltip           = GetTooltip( name )
    const buttonClasses     = classNames.concat( [ id ] )

    const buttonIcon = createEl( tag,
    {
        cls:    buttonClasses,
        attr:   { 'aria-label-position': 'bottom', 'aria-label': tooltip }
    } )

    setIcon( buttonIcon, icon )

    return buttonIcon
}
